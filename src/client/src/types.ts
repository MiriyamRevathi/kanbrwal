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
  role: UserRole;
  organizationId: string;
  teamId?: string;
  status: 'active' | 'inactive';
  title: string;
  avatarColor: string;
  createdAt: string;
  lastActive?: string;
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
  riskFactors?: string[];
  startDate: string;
  targetDate: string;
  budgetHours: number;
  createdAt: string;
  updatedAt: string;
  metrics?: {
    totalTasks: number;
    completedTasks: number;
    completionPercentage: number;
    overdueTasks: number;
    blockedTasks: number;
    p0UnfinishedTasks: number;
    unassignedTasks: number;
    estimatedHoursTotal: number;
    actualHoursTotal: number;
    hoursVariancePercentage: number;
    daysRemaining: number;
    deadlinePressureScore: number;
  };
};

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

export type Activity = {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  targetType: string;
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
  userId: string;
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

export type Board = {
  columns: Column[];
  tasks: Task[];
  projects: Project[];
  users: User[];
  teams: Team[];
  timesheets: TimesheetEntry[];
  activities: Activity[];
  notifications: Notification[];
  settings: SystemSettings;
  theme?: 'light' | 'dark';
};

export type ActiveView =
  | 'dashboard'
  | 'projects'
  | 'project_details'
  | 'kanban'
  | 'users'
  | 'teams'
  | 'time_tracking'
  | 'calendar'
  | 'reports'
  | 'audit_logs'
  | 'notifications'
  | 'settings';

export type RiskAssessment = {
  projectId: string;
  projectName: string;
  riskLevel: RiskLevel;
  riskScore: number;
  confidence: number;
  riskFactors: string[];
  recommendations: string[];
  metrics: {
    totalTasks: number;
    completedTasks: number;
    completionPercentage: number;
    overdueTasks: number;
    blockedTasks: number;
    p0UnfinishedTasks: number;
    unassignedTasks: number;
    estimatedHoursTotal: number;
    actualHoursTotal: number;
    hoursVariancePercentage: number;
    daysRemaining: number;
    deadlinePressureScore: number;
  };
};
