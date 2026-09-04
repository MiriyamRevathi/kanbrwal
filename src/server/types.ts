export type UserRole =
  | 'org_admin'
  | 'project_manager'
  | 'team_lead'
  | 'employee'
  | 'viewer';

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  organizationId: string;
  teamId?: string;
  status: 'active' | 'inactive';
  title: string;
  avatarColor: string;
  createdAt: string;
  lastActive?: string;
};

export type SafeUser = Omit<User, 'passwordHash' | 'salt'>;

export type Organization = {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
};

export type Team = {
  id: string;
  name: string;
  organizationId: string;
  leadId: string;
  leadName: string;
  memberIds: string[];
  description: string;
  createdAt: string;
};

export type Priority = 'P0' | 'P1' | 'P2';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'archived';

export type Project = {
  id: string;
  name: string;
  key: string;
  description: string;
  organizationId: string;
  managerId: string;
  managerName: string;
  teamIds: string[];
  status: ProjectStatus;
  priority: Priority;
  riskLevel: RiskLevel;
  riskScore: number;
  riskFactors: string[];
  startDate: string;
  targetDate: string;
  budgetHours: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskStatus = 'Backlog' | 'To Do' | 'In Progress' | 'Blocked' | 'Review' | 'Done';

export type SortBy = 'priority' | 'created' | 'updated' | 'dueDate';
export type SortOrder = 'asc' | 'desc';

export type Column = {
  name: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  column: string;
  priority: Priority;
  assigneeId?: string;
  assignee?: string;
  reporterId?: string;
  reporter?: string;
  dueDate?: string;
  estimatedHours: number;
  actualHours: number;
  tags: string[];
  dependencies: string[];
  riskLevel: RiskLevel;
  riskNotes?: string;
  createdAt: string;
  updatedAt: string;
};

export type TimesheetEntry = {
  id: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  taskId?: string;
  taskTitle?: string;
  date: string;
  hours: number;
  description: string;
  status: 'logged' | 'approved';
  createdAt: string;
};

export type ActivityAction =
  | 'login'
  | 'logout'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'task_created'
  | 'task_updated'
  | 'task_moved'
  | 'task_deleted'
  | 'task_assigned'
  | 'time_logged'
  | 'user_created'
  | 'user_updated'
  | 'settings_updated'
  | 'notification_sent';

export type Activity = {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: ActivityAction;
  targetType: 'project' | 'task' | 'user' | 'timesheet' | 'auth' | 'settings' | 'notification';
  targetId?: string;
  targetTitle?: string;
  details: string;
};

export type NotificationType =
  | 'info'
  | 'warning'
  | 'alert'
  | 'success'
  | 'announcement'
  | 'task_update'
  | 'project_update'
  | 'deadline'
  | 'risk_alert'
  | 'urgent';

export type NotificationPriority = 'normal' | 'important' | 'urgent';

export type Notification = {
  id: string;
  userId: string; // 'all' or specific userId or role selector
  senderId?: string;
  senderName?: string;
  senderRole?: UserRole;
  recipientRole?: UserRole;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  projectId?: string;
  taskId?: string;
  source?: 'system' | 'manual';
  link?: string;
  read: boolean;
  createdAt: string;
};

export type SystemSettings = {
  organizationName: string;
  allowSelfRegistration: boolean;
  defaultTheme: 'dark' | 'light';
  sessionTimeoutHours: number;
  mlRiskThresholds: {
    high: number;
    medium: number;
  };
  lastSeedReset: string;
};

export type KanbrawlData<TUser = SafeUser> = {
  columns: Column[];
  tasks: Task[];
  projects: Project[];
  users: TUser[];
  teams: Team[];
  timesheets: TimesheetEntry[];
  activities: Activity[];
  notifications: Notification[];
  settings: SystemSettings;
  theme?: 'light' | 'dark';
};

export type BoardEvent =
  | { type: 'task_created'; task: Task }
  | { type: 'task_updated'; task: Task }
  | { type: 'task_moved'; task: Task; fromColumn: string }
  | { type: 'task_deleted'; taskId: string }
  | { type: 'columns_updated'; columns: Column[] }
  | { type: 'project_created'; project: Project }
  | { type: 'project_updated'; project: Project }
  | { type: 'project_deleted'; projectId: string }
  | { type: 'activity_logged'; activity: Activity }
  | { type: 'timesheet_added'; timesheet: TimesheetEntry }
  | { type: 'notification_added'; notification: Notification }
  | { type: 'board_sync'; board: KanbrawlData<SafeUser> };
