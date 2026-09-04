import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EnterpriseStore } from './store/file-store.js';
import { MLRiskEngine } from './ml/risk-engine.js';

const taskOutputSchema = {
  id: z.string(),
  projectId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  column: z.string(),
  priority: z
    .enum(['P0', 'P1', 'P2'])
    .describe('P0 = urgent/critical, P1 = normal (default), P2 = low priority'),
  assignee: z.string(),
  assigneeId: z.string().optional(),
  reporter: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  riskNotes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export function registerTools(server: McpServer, store: EnterpriseStore): void {
  // ── 1. get_projects ──
  server.registerTool(
    'get_projects',
    {
      title: 'Get Projects',
      description: 'List all enterprise projects with status, risk level, and task statistics.',
      inputSchema: {},
      outputSchema: {
        projects: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            key: z.string(),
            description: z.string(),
            status: z.string(),
            priority: z.string(),
            riskLevel: z.string(),
            riskScore: z.number(),
            managerName: z.string(),
            totalTasks: z.number(),
            completedTasks: z.number(),
            targetDate: z.string(),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const allProjects = store.getProjects();
      const allTasks = store.getTasks();

      const projectsWithStats = allProjects.map((proj) => {
        const projTasks = allTasks.filter((t) => t.projectId === proj.id);
        const completed = projTasks.filter(
          (t) => t.column.toLowerCase() === 'done',
        ).length;
        const risk = MLRiskEngine.assessProjectRisk(proj, allTasks);
        return {
          id: proj.id,
          name: proj.name,
          key: proj.key,
          description: proj.description,
          status: proj.status,
          priority: proj.priority,
          riskLevel: risk.riskLevel,
          riskScore: risk.riskScore,
          managerName: proj.managerName,
          totalTasks: projTasks.length,
          completedTasks: completed,
          targetDate: proj.targetDate,
        };
      });

      const structuredContent = { projects: projectsWithStats };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(structuredContent, null, 2),
          },
        ],
        structuredContent,
      };
    },
  );

  // ── 2. get_project ──
  server.registerTool(
    'get_project',
    {
      title: 'Get Project',
      description: 'Get detailed information about a specific project by ID or key.',
      inputSchema: {
        id: z.string().describe('Project ID (e.g. "proj-ecom") or Project Key (e.g. "ECOM")'),
      },
      outputSchema: {
        project: z.object({
          id: z.string(),
          name: z.string(),
          key: z.string(),
          description: z.string(),
          status: z.string(),
          priority: z.string(),
          riskLevel: z.string(),
          riskScore: z.number(),
          managerName: z.string(),
          budgetHours: z.number(),
          startDate: z.string(),
          targetDate: z.string(),
        }),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      const proj = store.getProject(id);
      if (!proj) {
        return {
          content: [{ type: 'text', text: `Error: Project "${id}" not found.` }],
          isError: true,
        };
      }
      const allTasks = store.getTasks();
      const risk = MLRiskEngine.assessProjectRisk(proj, allTasks);
      const enrichedProject = {
        ...proj,
        riskLevel: risk.riskLevel,
        riskScore: risk.riskScore,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(enrichedProject, null, 2) }],
        structuredContent: { project: enrichedProject },
      };
    },
  );

  // ── 3. get_columns ──
  server.registerTool(
    'get_columns',
    {
      title: 'Get Columns',
      description: 'Get the list of kanban board columns with their task counts.',
      inputSchema: {},
      outputSchema: {
        columns: z.array(
          z.object({
            name: z.string().describe('Column name'),
            taskCount: z.number().describe('Number of tasks in the column'),
            sortBy: z
              .enum(['priority', 'created', 'updated', 'dueDate'])
              .describe('Sort field for tasks in this column'),
            sortOrder: z
              .enum(['asc', 'desc'])
              .describe('Sort order for tasks in this column'),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const allTasks = store.getTasks();
      const columnsWithCounts = store.getColumns().map((col) => ({
        name: col.name,
        taskCount: allTasks.filter((t) => t.column === col.name).length,
        sortBy: col.sortBy,
        sortOrder: col.sortOrder,
      }));
      const structuredContent = { columns: columnsWithCounts };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(structuredContent, null, 2),
          },
        ],
        structuredContent,
      };
    },
  );

  // ── 4. list_tasks ──
  server.registerTool(
    'list_tasks',
    {
      title: 'List Tasks',
      description:
        'List tasks on the kanban board, optionally filtered by project, column, priority, assignee, or search term.',
      inputSchema: {
        projectId: z
          .string()
          .optional()
          .describe('Filter tasks by project ID (e.g. "proj-ecom")'),
        column: z
          .string()
          .optional()
          .describe('Filter tasks by column name (e.g. "To Do", "In Progress", "Blocked", "Review", "Done")'),
        priority: z
          .enum(['P0', 'P1', 'P2'])
          .optional()
          .describe('Filter tasks by priority: P0 = urgent, P1 = normal, P2 = low'),
        assignee: z
          .string()
          .optional()
          .describe('Filter tasks by assignee name or email (case-insensitive)'),
        search: z
          .string()
          .optional()
          .describe('Search query matching title, description, or tags'),
        max: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('Maximum number of tasks to return (default: 50)'),
      },
      outputSchema: {
        tasks: z.array(z.object(taskOutputSchema)),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, column, priority, assignee, search, max }) => {
      let tasks = store.getTasks({
        projectId,
        column,
        priority,
        assignee,
        search,
      });

      // Sort by priority ascending (P0 first), then by creation date
      tasks.sort((a, b) => {
        const priorityCompare = a.priority.localeCompare(b.priority);
        if (priorityCompare !== 0) return priorityCompare;
        return a.createdAt.localeCompare(b.createdAt);
      });

      const limit = max ?? 50;
      tasks = tasks.slice(0, limit);

      const structuredContent = { tasks };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(structuredContent, null, 2),
          },
        ],
        structuredContent,
      };
    },
  );

  // ── 5. get_task ──
  server.registerTool(
    'get_task',
    {
      title: 'Get Task',
      description: 'Get full details of a specific task by ID.',
      inputSchema: {
        id: z.string().describe('Task ID (UUID or task-xxxx)'),
      },
      outputSchema: z.object(taskOutputSchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      const task = store.getTask(id);
      if (!task) {
        return {
          content: [{ type: 'text', text: `Error: Task "${id}" not found.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
        structuredContent: task,
      };
    },
  );

  // ── 6. create_task ──
  server.registerTool(
    'create_task',
    {
      title: 'Create Task',
      description: 'Create a new task on the enterprise kanban board.',
      inputSchema: {
        title: z.string().min(1, 'Title is required').max(200).describe('Task title'),
        description: z.string().max(4000).optional().describe('Task description'),
        projectId: z
          .string()
          .optional()
          .describe('Project ID to assign task to. Defaults to active project.'),
        column: z
          .string()
          .optional()
          .describe('Initial column (Backlog, To Do, In Progress, Blocked, Review, Done)'),
        priority: z
          .enum(['P0', 'P1', 'P2'])
          .optional()
          .describe('Priority: P0 (critical), P1 (normal), P2 (low)'),
        assignee: z.string().optional().describe('Assignee full name or email'),
        dueDate: z.string().optional().describe('Due date in ISO format (YYYY-MM-DD)'),
        estimatedHours: z.number().optional().describe('Estimated work hours'),
        tags: z.array(z.string()).optional().describe('Task tags/labels'),
        riskLevel: z.enum(['low', 'medium', 'high']).optional().describe('Risk classification'),
      },
      outputSchema: z.object(taskOutputSchema),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({
      title,
      description,
      projectId,
      column,
      priority,
      assignee,
      dueDate,
      estimatedHours,
      tags,
      riskLevel,
    }) => {
      try {
        const task = store.createTask({
          title,
          description,
          projectId,
          column,
          priority,
          assignee,
          dueDate,
          estimatedHours,
          tags,
          riskLevel,
        });

        store.logActivity({
          userId: 'mcp-agent',
          userName: 'AI Agent (MCP)',
          userRole: 'project_manager',
          action: 'task_created',
          targetType: 'task',
          targetId: task.id,
          targetTitle: task.title,
          details: `AI Agent created task "${task.title}".`,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
          structuredContent: task,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ── 7. update_task ──
  server.registerTool(
    'update_task',
    {
      title: 'Update Task',
      description: 'Update fields of an existing task.',
      inputSchema: {
        id: z.string().describe('Task ID to update'),
        title: z.string().min(1).max(200).optional().describe('Updated title'),
        description: z.string().max(4000).optional().describe('Updated description'),
        column: z.string().optional().describe('Target column name'),
        priority: z.enum(['P0', 'P1', 'P2']).optional().describe('Updated priority'),
        assignee: z.string().optional().describe('Updated assignee name'),
        dueDate: z.string().optional().describe('Updated due date (YYYY-MM-DD)'),
        estimatedHours: z.number().optional().describe('Updated estimated hours'),
        actualHours: z.number().optional().describe('Updated actual hours logged'),
        tags: z.array(z.string()).optional().describe('Updated tags'),
        riskLevel: z.enum(['low', 'medium', 'high']).optional().describe('Updated risk level'),
        riskNotes: z.string().optional().describe('Updated risk notes'),
      },
      outputSchema: z.object(taskOutputSchema),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, ...fields }) => {
      try {
        const task = store.updateTask(id, fields);
        store.logActivity({
          userId: 'mcp-agent',
          userName: 'AI Agent (MCP)',
          userRole: 'project_manager',
          action: 'task_updated',
          targetType: 'task',
          targetId: task.id,
          targetTitle: task.title,
          details: `AI Agent updated task "${task.title}".`,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
          structuredContent: task,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ── 8. move_task ──
  server.registerTool(
    'move_task',
    {
      title: 'Move Task',
      description: 'Move an existing task to a different Kanban column.',
      inputSchema: {
        id: z.string().describe('Task ID to move'),
        column: z
          .string()
          .describe('Target column name (e.g. Backlog, To Do, In Progress, Blocked, Review, Done)'),
      },
      outputSchema: z.object(taskOutputSchema),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, column }) => {
      try {
        const task = store.moveTask(id, column);
        store.logActivity({
          userId: 'mcp-agent',
          userName: 'AI Agent (MCP)',
          userRole: 'project_manager',
          action: 'task_moved',
          targetType: 'task',
          targetId: task.id,
          targetTitle: task.title,
          details: `AI Agent moved "${task.title}" to ${column}.`,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
          structuredContent: task,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ── 9. delete_task ──
  server.registerTool(
    'delete_task',
    {
      title: 'Delete Task',
      description: 'Permanently remove a task from the board.',
      inputSchema: {
        id: z.string().describe('Task ID to delete'),
      },
      outputSchema: {
        message: z.string(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const task = store.getTask(id);
        const title = task?.title ?? id;
        store.deleteTask(id);

        store.logActivity({
          userId: 'mcp-agent',
          userName: 'AI Agent (MCP)',
          userRole: 'project_manager',
          action: 'task_deleted',
          targetType: 'task',
          targetId: id,
          targetTitle: title,
          details: `AI Agent deleted task "${title}".`,
        });

        const structuredContent = { message: `Task "${id}" successfully deleted.` };
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ── 10. assign_task ──
  server.registerTool(
    'assign_task',
    {
      title: 'Assign Task',
      description: 'Assign a task to a user by assignee name or user ID.',
      inputSchema: {
        id: z.string().describe('Task ID to assign'),
        assignee: z.string().describe('Assignee full name, email, or user ID'),
      },
      outputSchema: z.object(taskOutputSchema),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, assignee }) => {
      try {
        const user = store.getUserWithAuth(assignee);
        const assigneeName = user ? user.name : assignee;
        const assigneeId = user ? user.id : '';

        const task = store.updateTask(id, {
          assignee: assigneeName,
          assigneeId,
        });

        store.logActivity({
          userId: 'mcp-agent',
          userName: 'AI Agent (MCP)',
          userRole: 'project_manager',
          action: 'task_assigned',
          targetType: 'task',
          targetId: task.id,
          targetTitle: task.title,
          details: `AI Agent assigned "${task.title}" to ${assigneeName}.`,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
          structuredContent: task,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ── 11. get_project_risk ──
  server.registerTool(
    'get_project_risk',
    {
      title: 'Get Project Risk',
      description: 'Compute local ML risk analysis and risk factors for a project.',
      inputSchema: {
        projectId: z.string().describe('Project ID (e.g. "proj-ecom", "proj-hosp")'),
      },
      outputSchema: {
        projectId: z.string(),
        projectName: z.string(),
        riskLevel: z.string(),
        riskScore: z.number(),
        confidence: z.number(),
        riskFactors: z.array(z.string()),
        recommendations: z.array(z.string()),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId }) => {
      const project = store.getProject(projectId);
      if (!project) {
        return {
          content: [{ type: 'text', text: `Error: Project "${projectId}" not found.` }],
          isError: true,
        };
      }

      const allTasks = store.getTasks();
      const assessment = MLRiskEngine.assessProjectRisk(project, allTasks);

      return {
        content: [{ type: 'text', text: JSON.stringify(assessment, null, 2) }],
        structuredContent: assessment,
      };
    },
  );

  // ── 12. get_project_summary ──
  server.registerTool(
    'get_project_summary',
    {
      title: 'Get Project Summary',
      description:
        'Get a comprehensive executive summary for a project including progress, team workload, risk, and recent activity.',
      inputSchema: {
        projectId: z.string().describe('Project ID to summarize'),
      },
      outputSchema: {
        project: z.any(),
        taskDistribution: z.record(z.string(), z.number()),
        completionPercentage: z.number(),
        risk: z.any(),
        recentActivities: z.array(z.any()),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId }) => {
      const project = store.getProject(projectId);
      if (!project) {
        return {
          content: [{ type: 'text', text: `Error: Project "${projectId}" not found.` }],
          isError: true,
        };
      }

      const allTasks = store.getTasks({ projectId });
      const distribution: Record<string, number> = {};
      for (const col of store.getColumnNames()) {
        distribution[col] = allTasks.filter((t) => t.column === col).length;
      }

      const completed = allTasks.filter((t) => t.column.toLowerCase() === 'done').length;
      const total = allTasks.length;
      const completionPercentage = total === 0 ? 100 : Math.round((completed / total) * 100);

      const risk = MLRiskEngine.assessProjectRisk(project, store.getTasks());
      const activities = store
        .getActivities(20)
        .filter((a) => a.targetId === projectId || allTasks.some((t) => t.id === a.targetId));

      const summary = {
        project,
        taskDistribution: distribution,
        completionPercentage,
        risk,
        recentActivities: activities,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        structuredContent: summary,
      };
    },
  );
}
