import type {
  Board,
  Project,
  Task,
  User,
  Team,
  Column,
  TimesheetEntry,
  Activity,
  Notification,
  SystemSettings,
  RiskAssessment,
} from './types.js';

let currentAuthToken = localStorage.getItem('kb_session_token') || '';

export function getAuthToken(): string {
  return currentAuthToken;
}

export function setAuthToken(token: string): void {
  currentAuthToken = token;
  localStorage.setItem('kb_session_token', token);
}

export function clearAuthToken(): void {
  currentAuthToken = '';
  localStorage.removeItem('kb_session_token');
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (currentAuthToken) {
    headers.Authorization = `Bearer ${currentAuthToken}`;
    headers['x-session-token'] = currentAuthToken;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If unauthorized, clear token
    clearAuthToken();
    window.dispatchEvent(new CustomEvent('auth-unauthorized'));
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Authentication required');
  }

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

// ── Auth ──
export async function login(email: string, password: string): Promise<{ user: User; token: string }> {
  const result = await request<{ user: User; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(result.token);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } finally {
    clearAuthToken();
  }
}

export async function fetchCurrentUser(): Promise<{ user: User } | null> {
  if (!currentAuthToken) return null;
  try {
    return await request<{ user: User }>('/api/auth/me');
  } catch {
    clearAuthToken();
    return null;
  }
}

// ── Board ──
export async function fetchBoard(): Promise<Board> {
  return request<Board>('/api/board');
}

export async function updateColumns(columns: Column[]): Promise<{ columns: Column[] }> {
  return request<{ columns: Column[] }>('/api/columns', {
    method: 'PUT',
    body: JSON.stringify({ columns }),
  });
}

// ── Projects ──
export async function fetchProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects');
}

export async function fetchProject(id: string): Promise<Project & { tasks: Task[]; riskAssessment: RiskAssessment }> {
  return request<Project & { tasks: Task[]; riskAssessment: RiskAssessment }>(`/api/projects/${id}`);
}

export async function createProject(project: Partial<Project>): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  });
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  return request<Project>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await request(`/api/projects/${id}`, { method: 'DELETE' });
}

// ── Tasks ──
export async function fetchTasks(params?: {
  projectId?: string;
  column?: string;
  priority?: string;
  assignee?: string;
  search?: string;
}): Promise<Task[]> {
  const query = new URLSearchParams();
  if (params?.projectId) query.set('projectId', params.projectId);
  if (params?.column) query.set('column', params.column);
  if (params?.priority) query.set('priority', params.priority);
  if (params?.assignee) query.set('assignee', params.assignee);
  if (params?.search) query.set('search', params.search);

  const qs = query.toString();
  return request<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`);
}

export async function fetchTask(id: string): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`);
}

export async function createTask(task: Partial<Task>): Promise<Task> {
  return request<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await request(`/api/tasks/${id}`, { method: 'DELETE' });
}

// ── Users ──
export async function fetchUsers(): Promise<User[]> {
  return request<User[]>('/api/users');
}

export async function createUser(data: Partial<User> & { password?: string }): Promise<User> {
  return request<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(id: string, data: Partial<User> & { password?: string }): Promise<User> {
  return request<User>(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteUser(id: string): Promise<void> {
  await request(`/api/users/${id}`, { method: 'DELETE' });
}

// ── Teams ──
export async function fetchTeams(): Promise<Team[]> {
  return request<Team[]>('/api/teams');
}

export async function createTeam(data: Partial<Team>): Promise<Team> {
  return request<Team>('/api/teams', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTeam(id: string, data: Partial<Team>): Promise<Team> {
  return request<Team>(`/api/teams/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ── Timesheets ──
export async function fetchTimesheets(params?: { userId?: string; projectId?: string }): Promise<TimesheetEntry[]> {
  const query = new URLSearchParams();
  if (params?.userId) query.set('userId', params.userId);
  if (params?.projectId) query.set('projectId', params.projectId);
  const qs = query.toString();
  return request<TimesheetEntry[]>(`/api/timesheets${qs ? `?${qs}` : ''}`);
}

export async function logTime(entry: {
  projectId: string;
  taskId?: string;
  date: string;
  hours: number;
  description: string;
}): Promise<TimesheetEntry> {
  return request<TimesheetEntry>('/api/timesheets', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

// ── ML Risk ──
export async function fetchRiskOverview(): Promise<Record<string, RiskAssessment>> {
  return request<Record<string, RiskAssessment>>('/api/risk/overview');
}

export async function fetchProjectRisk(projectId: string): Promise<RiskAssessment> {
  return request<RiskAssessment>(`/api/risk/project/${projectId}`);
}

// ── Activities & Notifications ──
export async function fetchActivities(): Promise<Activity[]> {
  return request<Activity[]>('/api/activities');
}

export async function fetchNotifications(): Promise<Notification[]> {
  return request<Notification[]>('/api/notifications');
}

export async function markNotificationRead(id: string): Promise<void> {
  await request(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export async function sendNotification(data: {
  recipient: string;
  title: string;
  message: string;
  type?: string;
  priority?: string;
  projectId?: string;
  taskId?: string;
}): Promise<Notification> {
  return request<Notification>('/api/notifications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Reports & Export ──
export async function fetchReportsSummary(): Promise<{
  summary: {
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    overdueTasks: number;
    totalHoursLogged: number;
  };
  workload: Array<{
    userId: string;
    userName: string;
    role: string;
    totalTasks: number;
    activeTasks: number;
    hoursLogged: number;
  }>;
  riskAssessments: Record<string, RiskAssessment>;
}> {
  return request('/api/reports/summary');
}

export function getExportUrl(format: 'csv' | 'json', entity: 'tasks' | 'projects' | 'timesheets' | 'activities'): string {
  return `/api/reports/export/${format}?entity=${entity}`;
}

// ── Settings & Reset ──
export async function fetchSettings(): Promise<SystemSettings> {
  return request<SystemSettings>('/api/settings');
}

export async function updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
  return request<SystemSettings>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function resetSeedData(): Promise<{ success: boolean; seed: Board }> {
  return request<{ success: boolean; seed: Board }>('/api/dev/reset-seed', {
    method: 'POST',
  });
}
