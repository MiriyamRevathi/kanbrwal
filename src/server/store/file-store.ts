import process from 'node:process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type {
  User,
  Project,
  Task,
  Team,
  Column,
  TimesheetEntry,
  Activity,
  Notification,
  NotificationType,
  NotificationPriority,
  SystemSettings,
  KanbrawlData,
  BoardEvent,
  Priority,
  RiskLevel,
  SafeUser,
  UserRole,
} from '../types.js';
import { generateSeedData } from './seed-data.js';

export class EnterpriseStore {
  private readonly dataDir: string;
  private inMemoryData: KanbrawlData<User>;
  private listeners: Array<(event: BoardEvent) => void> = [];

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? resolve(process.cwd(), 'data');
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    this.inMemoryData = this.loadAll();
  }

  // ── Atomic File Persistence Helper ──
  private safeWriteFile(filename: string, content: unknown): void {
    const filePath = join(this.dataDir, filename);
    const tempPath = join(this.dataDir, `${filename}.${uuidv4()}.tmp`);
    const json = JSON.stringify(content, null, 2) + '\n';

    try {
      writeFileSync(tempPath, json, 'utf8');
      renameSync(tempPath, filePath);
    } catch (error) {
      if (existsSync(tempPath)) {
        try {
          unlinkSync(tempPath);
        } catch {
          // ignore cleanup error
        }
      }
      throw error;
    }
  }

  private safeReadFile<T>(filename: string, fallback: T): T {
    const filePath = join(this.dataDir, filename);
    if (!existsSync(filePath)) {
      return fallback;
    }
    try {
      const raw = readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private saveFile(filename: string, content: unknown): void {
    this.safeWriteFile(filename, content);
  }

  private loadAll(): KanbrawlData<User> {
    const usersExist = existsSync(join(this.dataDir, 'users.json'));
    const projectsExist = existsSync(join(this.dataDir, 'projects.json'));
    const tasksExist = existsSync(join(this.dataDir, 'tasks.json'));

    if (!usersExist || !projectsExist || !tasksExist) {
      const seed = generateSeedData();
      this.persistAll(seed);
      return seed;
    }

    const seedDefaults = generateSeedData();

    return {
      users: this.safeReadFile<User[]>('users.json', seedDefaults.users),
      projects: this.safeReadFile<Project[]>('projects.json', seedDefaults.projects),
      tasks: this.safeReadFile<Task[]>('tasks.json', seedDefaults.tasks),
      teams: this.safeReadFile<Team[]>('teams.json', seedDefaults.teams),
      columns: this.safeReadFile<Column[]>('columns.json', seedDefaults.columns),
      timesheets: this.safeReadFile<TimesheetEntry[]>('timesheets.json', seedDefaults.timesheets),
      activities: this.safeReadFile<Activity[]>('activities.json', seedDefaults.activities),
      notifications: this.safeReadFile<Notification[]>('notifications.json', seedDefaults.notifications),
      settings: this.safeReadFile<SystemSettings>('settings.json', seedDefaults.settings),
      theme: 'dark',
    };
  }

  private persistAll(data: KanbrawlData<User>): void {
    this.saveFile('users.json', data.users);
    this.saveFile('projects.json', data.projects);
    this.saveFile('tasks.json', data.tasks);
    this.saveFile('teams.json', data.teams);
    this.saveFile('columns.json', data.columns);
    this.saveFile('timesheets.json', data.timesheets);
    this.saveFile('activities.json', data.activities);
    this.saveFile('notifications.json', data.notifications);
    this.saveFile('settings.json', data.settings);
  }

  public resetToSeed(): KanbrawlData<SafeUser> {
    const seed = generateSeedData();
    this.inMemoryData = seed;
    this.persistAll(seed);
    const safeBoard = this.getBoard();
    this.emit({ type: 'board_sync', board: structuredClone(safeBoard) });
    return structuredClone(safeBoard);
  }

  private emit(event: BoardEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('SSE listener error:', err);
      }
    }
  }

  public onChange(listener: (event: BoardEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getBoard(): KanbrawlData<SafeUser> {
    const { users, ...rest } = this.inMemoryData;
    return {
      ...structuredClone(rest),
      users: this.getUsers(),
    };
  }

  // ── Columns ──
  public getColumns(): Column[] {
    return structuredClone(this.inMemoryData.columns);
  }

  public getColumnNames(): string[] {
    return this.inMemoryData.columns.map((c) => c.name);
  }

  public updateColumns(columns: Column[]): Column[] {
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error('At least one column is required.');
    }
    const processed = columns
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        sortBy: c.sortBy ?? 'created',
        sortOrder: c.sortOrder ?? 'asc',
      }))
      .filter((c) => c.name.length > 0);

    if (processed.length === 0) {
      throw new Error('At least one non-empty column name is required.');
    }

    const seen = new Set<string>();
    const unique = processed.filter((c) => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });

    this.inMemoryData.columns = unique;
    this.saveFile('columns.json', this.inMemoryData.columns);
    this.emit({ type: 'columns_updated', columns: structuredClone(unique) });
    return structuredClone(unique);
  }

  // ── Users ──
  public getUsers(): SafeUser[] {
    return this.inMemoryData.users.map((u) => {
      const { passwordHash, salt, ...safe } = u;
      return safe;
    });
  }

  public getFullUsers(): User[] {
    return structuredClone(this.inMemoryData.users);
  }

  public getUser(id: string): SafeUser | undefined {
    const user = this.inMemoryData.users.find((u) => u.id === id);
    if (!user) return undefined;
    const { passwordHash, salt, ...safe } = user;
    return safe;
  }

  public getUserWithAuth(emailOrId: string): User | undefined {
    const lower = emailOrId.toLowerCase();
    const user = this.inMemoryData.users.find(
      (u) => u.id === emailOrId || u.email.toLowerCase() === lower,
    );
    return user ? structuredClone(user) : undefined;
  }

  public createUser(userData: Omit<User, 'id' | 'createdAt'>): SafeUser {
    if (this.inMemoryData.users.some((u) => u.email.toLowerCase() === userData.email.toLowerCase())) {
      throw new Error(`User with email "${userData.email}" already exists.`);
    }

    const newUser: User = {
      id: `usr-${uuidv4().slice(0, 8)}`,
      ...userData,
      createdAt: new Date().toISOString(),
    };

    this.inMemoryData.users.push(newUser);
    this.saveFile('users.json', this.inMemoryData.users);

    const { passwordHash, salt, ...safe } = newUser;
    return safe;
  }

  public updateUser(id: string, updates: Partial<User>): SafeUser {
    const index = this.inMemoryData.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error(`User with id "${id}" not found.`);
    }
    const current = this.inMemoryData.users[index];
    const updated: User = {
      ...current,
      ...updates,
      id: current.id, // prevent ID change
      createdAt: current.createdAt,
    };
    this.inMemoryData.users[index] = updated;
    this.saveFile('users.json', this.inMemoryData.users);

    const { passwordHash, salt, ...safe } = updated;
    return safe;
  }

  public deleteUser(id: string): void {
    const index = this.inMemoryData.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error(`User with id "${id}" not found.`);
    }
    this.inMemoryData.users.splice(index, 1);
    this.saveFile('users.json', this.inMemoryData.users);
  }

  // ── Projects ──
  public getProjects(): Project[] {
    return structuredClone(this.inMemoryData.projects);
  }

  public getProject(id: string): Project | undefined {
    const proj = this.inMemoryData.projects.find((p) => p.id === id || p.key === id);
    return proj ? structuredClone(proj) : undefined;
  }

  public createProject(projectData: {
    name: string;
    key?: string;
    description?: string;
    organizationId?: string;
    managerId?: string;
    managerName?: string;
    teamIds?: string[];
    priority?: Priority;
    startDate?: string;
    targetDate?: string;
    budgetHours?: number;
  }): Project {
    const now = new Date().toISOString();
    const id = `proj-${uuidv4().slice(0, 8)}`;
    const key = (
      projectData.key ||
      projectData.name
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 5)
        .toUpperCase() ||
      'PRJ'
    ).slice(0, 8);

    const newProject: Project = {
      id,
      name: projectData.name,
      key,
      description: projectData.description ?? '',
      organizationId: projectData.organizationId ?? 'org-global',
      managerId: projectData.managerId ?? '',
      managerName: projectData.managerName ?? 'Unassigned',
      teamIds: projectData.teamIds ?? [],
      status: 'in_progress',
      priority: projectData.priority ?? 'P1',
      riskLevel: 'low',
      riskScore: 20,
      riskFactors: [],
      startDate: projectData.startDate ?? now,
      targetDate: projectData.targetDate ?? now,
      budgetHours: projectData.budgetHours ?? 100,
      createdAt: now,
      updatedAt: now,
    };

    this.inMemoryData.projects.push(newProject);
    this.saveFile('projects.json', this.inMemoryData.projects);
    this.emit({ type: 'project_created', project: structuredClone(newProject) });
    return structuredClone(newProject);
  }

  public updateProject(id: string, updates: Partial<Project>): Project {
    const proj = this.inMemoryData.projects.find((p) => p.id === id);
    if (!proj) {
      throw new Error(`Project with id "${id}" not found.`);
    }

    Object.assign(proj, updates, {
      id: proj.id,
      updatedAt: new Date().toISOString(),
    });

    this.saveFile('projects.json', this.inMemoryData.projects);
    this.emit({ type: 'project_updated', project: structuredClone(proj) });
    return structuredClone(proj);
  }

  public deleteProject(id: string): void {
    const index = this.inMemoryData.projects.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Project with id "${id}" not found.`);
    }

    // Delete associated tasks
    this.inMemoryData.tasks = this.inMemoryData.tasks.filter((t) => t.projectId !== id);
    this.inMemoryData.projects.splice(index, 1);

    this.saveFile('projects.json', this.inMemoryData.projects);
    this.saveFile('tasks.json', this.inMemoryData.tasks);
    this.emit({ type: 'project_deleted', projectId: id });
  }

  // ── Tasks ──
  public getTasks(filter?: {
    projectId?: string;
    column?: string;
    priority?: Priority;
    assignee?: string;
    assigneeId?: string;
    search?: string;
  } | string): Task[] {
    let tasks = this.inMemoryData.tasks;

    if (typeof filter === 'string') {
      tasks = tasks.filter((t) => t.column === filter);
    } else if (filter) {
      if (filter.projectId && filter.projectId !== 'all') {
        tasks = tasks.filter((t) => t.projectId === filter.projectId);
      }
      if (filter.column && filter.column !== 'all') {
        tasks = tasks.filter((t) => t.column.toLowerCase() === filter.column!.toLowerCase());
      }
      if (filter.priority && filter.priority !== ('all' as Priority)) {
        tasks = tasks.filter((t) => t.priority === filter.priority);
      }
      if (filter.assigneeId) {
        tasks = tasks.filter((t) => t.assigneeId === filter.assigneeId);
      }
      if (filter.assignee) {
        const lower = filter.assignee.toLowerCase();
        tasks = tasks.filter(
          (t) =>
            t.assignee?.toLowerCase().includes(lower) ||
            t.assigneeId?.toLowerCase() === lower,
        );
      }
      if (filter.search) {
        const query = filter.search.toLowerCase();
        tasks = tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query) ||
            t.tags?.some((tag) => tag.toLowerCase().includes(query)),
        );
      }
    }

    return structuredClone(tasks);
  }

  public getTask(id: string): Task | undefined {
    const task = this.inMemoryData.tasks.find((t) => t.id === id);
    return task ? structuredClone(task) : undefined;
  }

  public createTask(
    titleOrData:
      | string
      | {
          title: string;
          description?: string;
          projectId?: string;
          column?: string;
          priority?: Priority;
          assigneeId?: string;
          assignee?: string;
          reporterId?: string;
          reporter?: string;
          dueDate?: string;
          estimatedHours?: number;
          actualHours?: number;
          tags?: string[];
          dependencies?: string[];
          riskLevel?: RiskLevel;
          riskNotes?: string;
        },
    descriptionArg?: string,
    columnArg?: string,
    priorityArg?: string,
    assigneeArg?: string,
  ): Task {
    let taskData: {
      title: string;
      description?: string;
      projectId?: string;
      column?: string;
      priority?: Priority;
      assigneeId?: string;
      assignee?: string;
      reporterId?: string;
      reporter?: string;
      dueDate?: string;
      estimatedHours?: number;
      actualHours?: number;
      tags?: string[];
      dependencies?: string[];
      riskLevel?: RiskLevel;
      riskNotes?: string;
    };

    if (typeof titleOrData === 'string') {
      taskData = {
        title: titleOrData,
        description: descriptionArg,
        column: columnArg,
        priority: priorityArg as Priority,
        assignee: assigneeArg,
      };
    } else {
      taskData = titleOrData;
    }

    const colNames = this.getColumnNames();
    const targetColumn = taskData.column ?? colNames[0] ?? 'Backlog';
    if (!colNames.includes(targetColumn)) {
      throw new Error(
        `Column "${targetColumn}" does not exist. Available columns: ${colNames.join(', ')}`,
      );
    }

    const projectId =
      taskData.projectId ||
      (this.inMemoryData.projects[0] ? this.inMemoryData.projects[0].id : 'proj-ecom');

    const now = new Date().toISOString();
    const newTask: Task = {
      id: `task-${uuidv4().slice(0, 8)}`,
      projectId,
      title: taskData.title.trim(),
      description: taskData.description?.trim() ?? '',
      column: targetColumn,
      priority: taskData.priority ?? 'P1',
      assigneeId: taskData.assigneeId ?? '',
      assignee:
        taskData.assignee ??
        (taskData.assigneeId ? this.getUser(taskData.assigneeId)?.name : '') ??
        '',
      reporterId: taskData.reporterId ?? '',
      reporter:
        taskData.reporter ??
        (taskData.reporterId ? this.getUser(taskData.reporterId)?.name : '') ??
        '',
      dueDate: taskData.dueDate ?? '',
      estimatedHours: taskData.estimatedHours ?? 8,
      actualHours: taskData.actualHours ?? 0,
      tags: taskData.tags ?? [],
      dependencies: taskData.dependencies ?? [],
      riskLevel: taskData.riskLevel ?? 'low',
      riskNotes: taskData.riskNotes ?? '',
      createdAt: now,
      updatedAt: now,
    };

    this.inMemoryData.tasks.push(newTask);
    this.saveFile('tasks.json', this.inMemoryData.tasks);
    this.emit({ type: 'task_created', task: structuredClone(newTask) });
    return structuredClone(newTask);
  }

  public updateTask(id: string, fields: Partial<Task>): Task {
    const task = this.inMemoryData.tasks.find((t) => t.id === id);
    if (!task) {
      throw new Error(`Task with id "${id}" not found.`);
    }

    if (fields.column && !this.getColumnNames().includes(fields.column)) {
      throw new Error(`Column "${fields.column}" does not exist.`);
    }

    if (fields.assigneeId !== undefined && !fields.assignee) {
      fields.assignee = this.getUser(fields.assigneeId)?.name ?? '';
    }

    Object.assign(task, fields, {
      id: task.id,
      updatedAt: new Date().toISOString(),
    });

    this.saveFile('tasks.json', this.inMemoryData.tasks);
    this.emit({ type: 'task_updated', task: structuredClone(task) });
    return structuredClone(task);
  }

  public moveTask(id: string, targetColumn: string): Task {
    const colNames = this.getColumnNames();
    if (!colNames.includes(targetColumn)) {
      throw new Error(
        `Column "${targetColumn}" does not exist. Available columns: ${colNames.join(', ')}`,
      );
    }

    const task = this.inMemoryData.tasks.find((t) => t.id === id);
    if (!task) {
      throw new Error(`Task with id "${id}" not found.`);
    }

    const fromColumn = task.column;
    task.column = targetColumn;
    task.updatedAt = new Date().toISOString();

    this.saveFile('tasks.json', this.inMemoryData.tasks);
    this.emit({
      type: 'task_moved',
      task: structuredClone(task),
      fromColumn,
    });
    return structuredClone(task);
  }

  public deleteTask(id: string): void {
    const index = this.inMemoryData.tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Task with id "${id}" not found.`);
    }

    this.inMemoryData.tasks.splice(index, 1);
    this.saveFile('tasks.json', this.inMemoryData.tasks);
    this.emit({ type: 'task_deleted', taskId: id });
  }

  // ── Teams ──
  public getTeams(): Team[] {
    return structuredClone(this.inMemoryData.teams);
  }

  public getTeam(id: string): Team | undefined {
    const team = this.inMemoryData.teams.find((t) => t.id === id);
    return team ? structuredClone(team) : undefined;
  }

  public createTeam(teamData: {
    name: string;
    organizationId?: string;
    leadId?: string;
    memberIds?: string[];
    description?: string;
  }): Team {
    const lead = teamData.leadId ? this.getUser(teamData.leadId) : undefined;
    const newTeam: Team = {
      id: `team-${uuidv4().slice(0, 8)}`,
      name: teamData.name,
      organizationId: teamData.organizationId ?? 'org-global',
      leadId: teamData.leadId ?? '',
      leadName: lead?.name ?? 'Unassigned',
      memberIds: teamData.memberIds ?? [],
      description: teamData.description ?? '',
      createdAt: new Date().toISOString(),
    };

    this.inMemoryData.teams.push(newTeam);
    this.saveFile('teams.json', this.inMemoryData.teams);
    return structuredClone(newTeam);
  }

  public updateTeam(id: string, updates: Partial<Team>): Team {
    const team = this.inMemoryData.teams.find((t) => t.id === id);
    if (!team) {
      throw new Error(`Team with id "${id}" not found.`);
    }
    if (updates.leadId && !updates.leadName) {
      updates.leadName = this.getUser(updates.leadId)?.name ?? 'Unassigned';
    }
    Object.assign(team, updates, { id: team.id });
    this.saveFile('teams.json', this.inMemoryData.teams);
    return structuredClone(team);
  }

  // ── Timesheets ──
  public getTimesheets(filter?: { userId?: string; projectId?: string }): TimesheetEntry[] {
    let list = this.inMemoryData.timesheets;
    if (filter?.userId) {
      list = list.filter((t) => t.userId === filter.userId);
    }
    if (filter?.projectId) {
      list = list.filter((t) => t.projectId === filter.projectId);
    }
    return structuredClone(list);
  }

  public logTime(entry: {
    userId: string;
    userName?: string;
    projectId: string;
    projectName?: string;
    taskId?: string;
    taskTitle?: string;
    date: string;
    hours: number;
    description: string;
    status?: 'logged' | 'approved';
  }): TimesheetEntry {
    const user = this.getUser(entry.userId);
    const project = this.getProject(entry.projectId);
    const task = entry.taskId ? this.getTask(entry.taskId) : undefined;

    const newEntry: TimesheetEntry = {
      id: `ts-${uuidv4().slice(0, 8)}`,
      userId: entry.userId,
      userName: entry.userName ?? user?.name ?? 'Unknown User',
      projectId: entry.projectId,
      projectName: entry.projectName ?? project?.name ?? 'General Project',
      taskId: entry.taskId,
      taskTitle: entry.taskTitle ?? task?.title,
      date: entry.date,
      hours: entry.hours,
      description: entry.description,
      status: entry.status ?? 'logged',
      createdAt: new Date().toISOString(),
    };

    this.inMemoryData.timesheets.unshift(newEntry);
    this.saveFile('timesheets.json', this.inMemoryData.timesheets);

    if (task && entry.hours > 0) {
      this.updateTask(task.id, {
        actualHours: (task.actualHours || 0) + entry.hours,
      });
    }

    this.emit({ type: 'timesheet_added', timesheet: structuredClone(newEntry) });
    return structuredClone(newEntry);
  }

  // ── Audit Logs / Activities ──
  public getActivities(limit = 100): Activity[] {
    return structuredClone(this.inMemoryData.activities.slice(0, limit));
  }

  public logActivity(activity: {
    userId: string;
    userName?: string;
    userRole?: UserRole;
    action: Activity['action'];
    targetType: Activity['targetType'];
    targetId?: string;
    targetTitle?: string;
    details: string;
  }): Activity {
    const user = this.getUser(activity.userId);
    const newAct: Activity = {
      id: `act-${uuidv4().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      userId: activity.userId,
      userName: activity.userName ?? user?.name ?? 'System',
      userRole: (activity.userRole ?? user?.role ?? 'employee') as UserRole,
      action: activity.action,
      targetType: activity.targetType,
      targetId: activity.targetId,
      targetTitle: activity.targetTitle,
      details: activity.details,
    };

    this.inMemoryData.activities.unshift(newAct);
    if (this.inMemoryData.activities.length > 500) {
      this.inMemoryData.activities = this.inMemoryData.activities.slice(0, 500);
    }
    this.saveFile('activities.json', this.inMemoryData.activities);
    this.emit({ type: 'activity_logged', activity: structuredClone(newAct) });
    return structuredClone(newAct);
  }

  // ── Notifications ──
  public getNotifications(userId?: string, userRole?: UserRole): Notification[] {
    let list = this.inMemoryData.notifications;
    if (userId) {
      list = list.filter(
        (n) =>
          n.userId === userId ||
          n.userId === 'all' ||
          (userRole && n.recipientRole === userRole) ||
          (userRole && n.userId === userRole),
      );
    }
    return structuredClone(list);
  }

  public addNotification(notification: {
    userId: string;
    senderId?: string;
    senderName?: string;
    senderRole?: UserRole;
    recipientRole?: UserRole;
    title: string;
    message: string;
    type?: NotificationType;
    priority?: NotificationPriority;
    projectId?: string;
    taskId?: string;
    source?: 'system' | 'manual';
    link?: string;
  }): Notification {
    const newNotif: Notification = {
      id: `notif-${uuidv4().slice(0, 8)}`,
      userId: notification.userId,
      senderId: notification.senderId,
      senderName: notification.senderName,
      senderRole: notification.senderRole,
      recipientRole: notification.recipientRole,
      title: notification.title,
      message: notification.message,
      type: notification.type ?? 'info',
      priority: notification.priority ?? 'normal',
      projectId: notification.projectId,
      taskId: notification.taskId,
      source: notification.source ?? 'system',
      link: notification.link,
      read: false,
      createdAt: new Date().toISOString(),
    };

    this.inMemoryData.notifications.unshift(newNotif);
    this.saveFile('notifications.json', this.inMemoryData.notifications);
    this.emit({ type: 'notification_added', notification: structuredClone(newNotif) });
    return structuredClone(newNotif);
  }

  public markNotificationAsRead(id: string): void {
    const notif = this.inMemoryData.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.saveFile('notifications.json', this.inMemoryData.notifications);
    }
  }

  // ── Settings ──
  public getSettings(): SystemSettings {
    return structuredClone(this.inMemoryData.settings);
  }

  public updateSettings(updates: Partial<SystemSettings>): SystemSettings {
    Object.assign(this.inMemoryData.settings, updates);
    this.saveFile('settings.json', this.inMemoryData.settings);
    return structuredClone(this.inMemoryData.settings);
  }
}

export const BoardStore = EnterpriseStore;
