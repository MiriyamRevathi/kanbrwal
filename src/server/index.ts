import process from 'node:process';
import { createServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { EnterpriseStore, BoardStore } from './store/file-store.js';
import { SSEManager } from './sse.js';
import { registerTools } from './tools.js';
import { createApiRouter } from './api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PORT = 8431;

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port);
  });
}

async function findAvailablePort(preferred: number): Promise<number> {
  if (await isPortAvailable(preferred)) {
    return preferred;
  }

  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
    server.listen(0);
  });
}

export function createMcpServer(store: EnterpriseStore): McpServer {
  const mcpServer = new McpServer({
    name: 'kanbrawl-enterprise-mcp-server',
    version: '2.0.0',
  });
  registerTools(mcpServer, store);
  return mcpServer;
}

export type ServerOptions = {
  stdio?: boolean;
  port?: number;
  dataDir?: string;
};

export async function startServer(
  options: ServerOptions = {},
): Promise<Server> {
  const log = options.stdio
    ? console.error.bind(console)
    : console.log.bind(console);

  // ── Initialize core services ──
  const store = new EnterpriseStore(options.dataDir);
  const sse = new SSEManager();
  const mcpServer = createMcpServer(store);

  // Helper to get sanitized board state without sensitive password hashes
  const getSanitizedBoard = () => {
    const raw = store.getBoard();
    return {
      ...raw,
      users: store.getUsers(),
    };
  };

  // Wire SSE broadcast to store events
  store.onChange((event) => {
    if (event.type === 'board_sync') {
      sse.broadcast({ type: 'board_sync', board: getSanitizedBoard() });
    } else {
      sse.broadcast(event);
    }
  });

  // ── MCP Stdio Transport ──
  if (options.stdio) {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
  }

  // ── Express Application ──
  const app = express();
  app.use(express.json());

  // MCP Streamable HTTP endpoint (POST) & Interactive Info Page (GET)
  if (!options.stdio) {
    app.post('/mcp', async (request, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', async () => transport.close());
      await mcpServer.connect(transport);
      await transport.handleRequest(request, res, request.body);
    });

    app.get('/mcp', (_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kanbrawl Enterprise MCP Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1117; color: #f0f2f8; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    h1 { color: #4f6cf7; margin-bottom: 0.5rem; }
    .card { background: #171a23; border: 1px solid #313749; border-radius: 8px; padding: 1.5rem; margin-top: 1.5rem; }
    .badge { display: inline-block; background: #0d2b1b; color: #55db90; border: 1px solid #175435; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: bold; font-size: 0.8rem; }
    pre { background: #12141c; padding: 1rem; border-radius: 6px; overflow-x: auto; border: 1px solid #242938; font-family: monospace; color: #a3adc2; }
    a { color: #4f6cf7; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
    .btn { display: inline-block; background: #4f6cf7; color: white; padding: 0.6rem 1.2rem; border-radius: 4px; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>Kanbrawl Model Context Protocol (MCP) Server</h1>
  <p><span class="badge">ACTIVE</span> • Streamable HTTP transport listening on <code>/mcp</code></p>
  
  <div class="card">
    <h3>Web Application</h3>
    <p>To interact with the visual enterprise dashboard, Kanban board, and project management views, visit the main application:</p>
    <a href="/" class="btn">Open Web Application</a>
  </div>

  <div class="card">
    <h3>AI Agent Configuration</h3>
    <p>Configure your AI assistant (Claude Code, Cursor, Windsurf, Copilot, Gemini CLI) to use this MCP endpoint:</p>
    <pre>{
  "mcpServers": {
    "kanbrawl": {
      "url": "http://localhost:8431/mcp"
    }
  }
}</pre>
    <h4>12 Registered Tools:</h4>
    <p><code>get_projects</code>, <code>get_project</code>, <code>get_columns</code>, <code>list_tasks</code>, <code>get_task</code>, <code>create_task</code>, <code>update_task</code>, <code>move_task</code>, <code>delete_task</code>, <code>assign_task</code>, <code>get_project_risk</code>, <code>get_project_summary</code></p>
  </div>
</body>
</html>`);
    });
  }

  // SSE endpoint for live multi-client updates
  app.get('/events', (_request, res) => {
    sse.addClient(res);

    // Initial sanitized state push
    const board = getSanitizedBoard();
    res.write(
      `event: board_sync\ndata: ${JSON.stringify({ type: 'board_sync', board })}\n\n`,
    );
  });

  // Enterprise REST API
  app.use('/api', createApiRouter(store));

  // Determine static client directory
  const candidates = [
    resolve(__dirname, '../client'),
    resolve(__dirname, '../../dist/client'),
    resolve(process.cwd(), 'dist/client'),
  ];
  let clientDirectory = candidates.find((dir) => existsSync(dir));

  if (clientDirectory) {
    app.use(express.static(clientDirectory));
    // SPA fallback for all browser routes
    app.use((_request, res) => {
      res.sendFile(join(clientDirectory!, 'index.html'));
    });
  }

  // Start server
  const requestedPort =
    options.port ??
    Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  const port = await findAvailablePort(requestedPort);
  if (port !== requestedPort) {
    log(`[INFO] Port ${requestedPort} is in use, using port ${port} instead`);
  }

  const server = app.listen(port, () => {
    log(`=======================================================`);
    log(`  Kanbrawl Enterprise Project Management Web Platform `);
    log(`=======================================================`);
    log(`  Web Application : http://localhost:${port}`);
    if (!options.stdio) {
      log(`  MCP Endpoint    : http://localhost:${port}/mcp`);
    }
    log(`  SSE Live Stream : http://localhost:${port}/events`);
    log(`  Persistence     : Local JSON (Atomic File Store)`);
    log(`=======================================================`);
  });

  return server;
}

// If executed directly, run the server
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
