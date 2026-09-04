export type MCPToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[]; items?: { type: string } }>;
    required?: string[];
  };
};

export const ENTERPRISE_MCP_TOOL_CATALOG: MCPToolDefinition[] = [
  {
    name: 'get_projects',
    description: 'Retrieve all enterprise projects with risk scores, budget metrics, and task counts.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter projects by status (planning, in_progress, on_hold, completed, archived)', enum: ['planning', 'in_progress', 'on_hold', 'completed', 'archived'] },
        riskLevel: { type: 'string', description: 'Filter projects by risk level (low, medium, high)', enum: ['low', 'medium', 'high'] },
      },
    },
  },
  {
    name: 'get_project',
    description: 'Fetch detailed information for a single project including risk analysis and velocity forecast.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project unique ID or key (e.g. proj-ecom or ECOM)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List deliverables across the enterprise or filtered by project, column, priority, or assignee.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID filter' },
        column: { type: 'string', description: 'Kanban column status filter (Backlog, To Do, In Progress, Blocked, Review, Done)' },
        priority: { type: 'string', description: 'Task priority (P0, P1, P2)', enum: ['P0', 'P1', 'P2'] },
        assigneeId: { type: 'string', description: 'Assignee user ID filter' },
      },
    },
  },
  {
    name: 'get_task',
    description: 'Fetch a single task record by ID with risk notes, effort accounting, and assignment details.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task unique ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new enterprise task deliverable.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task summary title' },
        projectId: { type: 'string', description: 'Target project ID' },
        column: { type: 'string', description: 'Kanban column name (defaults to Backlog)' },
        priority: { type: 'string', description: 'Priority level (P0, P1, P2)', enum: ['P0', 'P1', 'P2'] },
        assigneeId: { type: 'string', description: 'Assigned user ID' },
        description: { type: 'string', description: 'Detailed architectural requirements' },
        dueDate: { type: 'string', description: 'Target due date (YYYY-MM-DD)' },
        estimatedHours: { type: 'number', description: 'Estimated effort in hours' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update fields of an existing task.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task unique ID' },
        title: { type: 'string', description: 'New task title' },
        column: { type: 'string', description: 'New column status' },
        priority: { type: 'string', description: 'New priority level', enum: ['P0', 'P1', 'P2'] },
        assigneeId: { type: 'string', description: 'New assignee user ID' },
        riskLevel: { type: 'string', description: 'Risk level assessment', enum: ['low', 'medium', 'high'] },
      },
      required: ['id'],
    },
  },
  {
    name: 'move_task',
    description: 'Move a task deliverable to a different Kanban column status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task unique ID' },
        column: { type: 'string', description: 'Target column status name' },
      },
      required: ['id', 'column'],
    },
  },
  {
    name: 'delete_task',
    description: 'Permanently remove a task deliverable.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task unique ID to remove' },
      },
      required: ['id'],
    },
  },
  {
    name: 'assign_task',
    description: 'Assign a task deliverable to an employee or team lead.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task unique ID' },
        assigneeId: { type: 'string', description: 'User ID to assign task to' },
      },
      required: ['id', 'assigneeId'],
    },
  },
  {
    name: 'get_project_risk',
    description: 'Run heuristic ML risk assessment for a specific project.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project unique ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_project_summary',
    description: 'Get high-level executive summary report for portfolio management.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
