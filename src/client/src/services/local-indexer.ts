import type { Task, Project, User } from '../types.js';

export type ClientSearchFilter = 'all' | 'tasks' | 'projects' | 'users';

export type ClientSearchResult = {
  id: string;
  type: 'task' | 'project' | 'user';
  title: string;
  subtitle: string;
  score: number;
};

export class ClientLocalIndexer {
  private taskCache: Task[] = [];
  private projectCache: Project[] = [];
  private userCache: User[] = [];

  public updateCache(data: { tasks?: Task[]; projects?: Project[]; users?: User[] }): void {
    if (data.tasks) this.taskCache = data.tasks;
    if (data.projects) this.projectCache = data.projects;
    if (data.users) this.userCache = data.users;
  }

  public query(term: string, filter: ClientSearchFilter = 'all'): ClientSearchResult[] {
    const q = term.toLowerCase().trim();
    if (!q) return [];

    const results: ClientSearchResult[] = [];

    if (filter === 'all' || filter === 'projects') {
      for (const p of this.projectCache) {
        if (p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)) {
          results.push({
            id: p.id,
            type: 'project',
            title: `[${p.key}] ${p.name}`,
            subtitle: `Manager: ${p.managerName || 'Unassigned'} | Risk: ${p.riskLevel.toUpperCase()}`,
            score: p.key.toLowerCase().includes(q) ? 10 : 5,
          });
        }
      }
    }

    if (filter === 'all' || filter === 'tasks') {
      for (const t of this.taskCache) {
        if (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || (t.tags || []).some((tag) => tag.toLowerCase().includes(q))) {
          results.push({
            id: t.id,
            type: 'task',
            title: t.title,
            subtitle: `Status: ${t.column} | Assignee: ${t.assignee || 'Unassigned'} | Priority: ${t.priority}`,
            score: t.title.toLowerCase().includes(q) ? 8 : 4,
          });
        }
      }
    }

    if (filter === 'all' || filter === 'users') {
      for (const u of this.userCache) {
        if (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)) {
          results.push({
            id: u.id,
            type: 'user',
            title: u.name,
            subtitle: `${u.title} (${u.role.replace('_', ' ').toUpperCase()})`,
            score: u.name.toLowerCase().includes(q) ? 9 : 3,
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  public getCacheStats(): { taskCount: number; projectCount: number; userCount: number } {
    return {
      taskCount: this.taskCache.length,
      projectCount: this.projectCache.length,
      userCount: this.userCache.length,
    };
  }
}

export const globalClientIndexer = new ClientLocalIndexer();
