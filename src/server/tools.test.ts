import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { EnterpriseStore } from './store/file-store.js';
import { createMcpServer } from './index.js';

async function createTestClient(store: EnterpriseStore) {
  const mcpServer = createMcpServer(store);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcpServer.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return client;
}

describe('MCP Tools Suite', () => {
  let store: EnterpriseStore;
  let client: Client;
  let dir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'kanbrawl-mcp-test-'));
    store = new EnterpriseStore(dir);
    client = await createTestClient(store);
  });

  afterEach(async () => {
    await client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('discovers all registered MCP enterprise tools', async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('get_projects');
    expect(toolNames).toContain('get_project');
    expect(toolNames).toContain('get_columns');
    expect(toolNames).toContain('list_tasks');
    expect(toolNames).toContain('get_task');
    expect(toolNames).toContain('create_task');
    expect(toolNames).toContain('update_task');
    expect(toolNames).toContain('move_task');
    expect(toolNames).toContain('delete_task');
    expect(toolNames).toContain('assign_task');
    expect(toolNames).toContain('get_project_risk');
    expect(toolNames).toContain('get_project_summary');
  });

  it('executes get_projects tool', async () => {
    const result = await client.callTool({ name: 'get_projects', arguments: {} });
    expect(result.isError).toBeFalsy();
    const content = (result.content as Array<{ text: string }>)[0].text;
    const parsed = JSON.parse(content);
    expect(parsed.projects.length).toBeGreaterThanOrEqual(4);
  });

  it('executes get_columns tool', async () => {
    const result = await client.callTool({ name: 'get_columns', arguments: {} });
    expect(result.isError).toBeFalsy();
    const content = (result.content as Array<{ text: string }>)[0].text;
    const parsed = JSON.parse(content);
    expect(parsed.columns.map((c: { name: string }) => c.name)).toEqual([
      'Backlog',
      'To Do',
      'In Progress',
      'Blocked',
      'Review',
      'Done',
    ]);
  });

  it('creates, moves, and updates task via MCP tools', async () => {
    // 1. Create task
    const createRes = await client.callTool({
      name: 'create_task',
      arguments: {
        title: 'MCP Autonomous Deliverable',
        column: 'Backlog',
        priority: 'P0',
        assignee: 'David Chen',
        estimatedHours: 16,
      },
    });
    expect(createRes.isError).toBeFalsy();
    const created = JSON.parse((createRes.content as Array<{ text: string }>)[0].text);
    expect(created.title).toBe('MCP Autonomous Deliverable');
    expect(created.column).toBe('Backlog');

    // 2. Move task
    const moveRes = await client.callTool({
      name: 'move_task',
      arguments: {
        id: created.id,
        column: 'In Progress',
      },
    });
    expect(moveRes.isError).toBeFalsy();
    const moved = JSON.parse((moveRes.content as Array<{ text: string }>)[0].text);
    expect(moved.column).toBe('In Progress');

    // 3. Assign task
    const assignRes = await client.callTool({
      name: 'assign_task',
      arguments: {
        id: created.id,
        assignee: 'Sarah Jenkins',
      },
    });
    expect(assignRes.isError).toBeFalsy();
    const assigned = JSON.parse((assignRes.content as Array<{ text: string }>)[0].text);
    expect(assigned.assignee).toBe('Sarah Jenkins');

    // 4. Get Task
    const getRes = await client.callTool({
      name: 'get_task',
      arguments: { id: created.id },
    });
    expect(getRes.isError).toBeFalsy();

    // 5. Delete Task
    const delRes = await client.callTool({
      name: 'delete_task',
      arguments: { id: created.id },
    });
    expect(delRes.isError).toBeFalsy();
    expect(store.getTask(created.id)).toBeUndefined();
  });

  it('calculates project risk via get_project_risk MCP tool', async () => {
    const result = await client.callTool({
      name: 'get_project_risk',
      arguments: { projectId: 'proj-hosp' },
    });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.riskLevel).toBeDefined();
    expect(parsed.riskScore).toBeDefined();
    expect(parsed.riskFactors.length).toBeGreaterThan(0);
  });
});
