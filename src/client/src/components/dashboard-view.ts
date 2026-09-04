import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Board, Project, Task, User, Activity } from '../types.js';

@customElement('dashboard-view')
export class DashboardView extends LitElement {
  @property({ type: Object }) board: Board = {
    columns: [],
    tasks: [],
    projects: [],
    users: [],
    teams: [],
    timesheets: [],
    activities: [],
    notifications: [],
    settings: {
      organizationName: '',
      allowSelfRegistration: false,
      defaultTheme: 'dark',
      sessionTimeoutHours: 24,
      mlRiskThresholds: { high: 65, medium: 35 },
      lastSeedReset: '',
    },
  };
  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: String }) selectedProjectId = 'all';

  static styles = [
    commonStyles,
    css`
      :host {
        display: block;
        padding: 1.5rem;
        overflow-y: auto;
        height: 100%;
      }

      .dashboard-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
      }

      .dashboard-title-area {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 1.5rem;
      }

      @media (max-width: 1024px) {
        .dashboard-grid {
          grid-template-columns: 1fr;
        }
      }

      .section-stack {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .progress-bar-bg {
        width: 100%;
        height: 6px;
        background: var(--surface-secondary);
        border-radius: 3px;
        overflow: hidden;
        margin-top: 0.5rem;
      }

      .progress-bar-fill {
        height: 100%;
        background: var(--primary);
        border-radius: 3px;
      }

      .activity-item {
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--border-subtle);
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .activity-item:last-child {
        border-bottom: none;
      }

      .activity-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.6875rem;
        color: var(--text-muted);
      }

      .activity-text {
        font-size: 0.8125rem;
        color: var(--text-primary);
        line-height: 1.3;
      }

      .risk-score-pill {
        display: inline-block;
        padding: 0.15rem 0.4rem;
        border-radius: 3px;
        font-size: 0.6875rem;
        font-weight: 700;
        font-family: 'Space Mono', monospace;
      }
    `,
  ];

  private viewProject(projectId: string) {
    this.dispatchEvent(
      new CustomEvent('project-detail-select', {
        detail: { projectId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const projects =
      this.selectedProjectId === 'all'
        ? this.board.projects || []
        : (this.board.projects || []).filter((p) => p.id === this.selectedProjectId);

    const tasks =
      this.selectedProjectId === 'all'
        ? this.board.tasks || []
        : (this.board.tasks || []).filter((t) => t.projectId === this.selectedProjectId);

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'in_progress').length;
    const completedProjects = projects.filter((p) => p.status === 'completed').length;
    const highRiskProjects = projects.filter((p) => p.riskLevel === 'high').length;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.column.toLowerCase() === 'done').length;
    const completionRate =
      totalTasks === 0 ? 100 : Math.round((completedTasks / totalTasks) * 100);

    const now = Date.now();
    const overdueTasks = tasks.filter((t) => {
      if (!t.dueDate || t.column.toLowerCase() === 'done') return false;
      return new Date(t.dueDate).getTime() < now;
    }).length;

    const totalHoursLogged = (this.board.timesheets || []).reduce(
      (sum, ts) => sum + ts.hours,
      0,
    );

    const isLead = this.currentUser?.role === 'team_lead';

    // For team leads: find their team and restrict activity/capacity to team members
    const myTeam = isLead
      ? (this.board.teams || []).find(
          (t) => t.leadId === this.currentUser?.id || (t.memberIds || []).includes(this.currentUser?.id || ''),
        )
      : undefined;
    const myTeamMemberIds: string[] = myTeam ? myTeam.memberIds || [] : [];

    const allActivities = this.board.activities || [];
    const recentActivities = isLead && myTeamMemberIds.length > 0
      ? allActivities
          .filter((act) => myTeamMemberIds.includes(act.userId) || act.userId === this.currentUser?.id)
          .slice(0, 8)
      : allActivities.slice(0, 8);

    // For team capacity: show only team members for leads, or first 6 for others
    const capacityUsers = isLead && myTeamMemberIds.length > 0
      ? (this.board.users || []).filter((u) => myTeamMemberIds.includes(u.id))
      : (this.board.users || []).slice(0, 6);

    const upcomingTasks = tasks
      .filter((t) => t.column.toLowerCase() !== 'done' && t.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 6);

    return html`
      <div class="dashboard-header">
        <div class="dashboard-title-area">
          <h1>Executive Dashboard</h1>
          <p>
            ${this.board.settings?.organizationName || 'Enterprise'} • Project Health & Resource Velocity Overview
          </p>
        </div>
      </div>

      <!-- High-Level Metric Tiles -->
      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-label">Total Projects</span>
          <span class="stat-value">${totalProjects}</span>
          <span class="stat-helper">${activeProjects} Active • ${completedProjects} Done</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Task Completion</span>
          <span class="stat-value">${completionRate}%</span>
          <span class="stat-helper">${completedTasks} of ${totalTasks} items completed</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Overdue Tasks</span>
          <span class="stat-value" style="color: ${overdueTasks > 0 ? '#ff6e78' : 'inherit'};">
            ${overdueTasks}
          </span>
          <span class="stat-helper">Pending attention</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">High Risk Projects</span>
          <span class="stat-value" style="color: ${highRiskProjects > 0 ? '#ff6e78' : 'inherit'};">
            ${highRiskProjects}
          </span>
          <span class="stat-helper">ML Risk Engine alert</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Hours Logged</span>
          <span class="stat-value">${totalHoursLogged}h</span>
          <span class="stat-helper">Across active sprints</span>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="section-stack">
          <!-- Active Projects Health Card -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Project Status & ML Risk Health</span>
              <button
                class="btn btn-outline btn-sm"
                @click=${() =>
                  this.dispatchEvent(
                    new CustomEvent('view-change', {
                      detail: { view: 'projects' },
                      bubbles: true,
                      composed: true,
                    }),
                  )}
              >
                View All Projects
              </button>
            </div>

            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Manager</th>
                    <th>Progress</th>
                    <th>ML Risk Level</th>
                    <th>Risk Score</th>
                    <th>Deadline</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${projects.map((p) => {
                    const pTasks = (this.board.tasks || []).filter((t) => t.projectId === p.id);
                    const pDone = pTasks.filter((t) => t.column.toLowerCase() === 'done').length;
                    const pPct = pTasks.length === 0 ? 100 : Math.round((pDone / pTasks.length) * 100);
                    return html`
                      <tr>
                        <td>
                          <strong>[${p.key}]</strong> ${p.name}
                        </td>
                        <td>${p.managerName || 'Unassigned'}</td>
                        <td style="min-width: 120px;">
                          <div style="font-size: 0.75rem; margin-bottom: 2px;">${pPct}% (${pDone}/${pTasks.length})</div>
                          <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${pPct}%"></div>
                          </div>
                        </td>
                        <td>
                          <span class="badge badge-risk-${p.riskLevel || 'low'}">
                            ${p.riskLevel || 'LOW'}
                          </span>
                        </td>
                        <td>
                          <span class="risk-score-pill badge-risk-${p.riskLevel || 'low'}">
                            ${p.riskScore || 0}/100
                          </span>
                        </td>
                        <td style="font-family: 'Space Mono', monospace; font-size: 0.75rem;">
                          ${p.targetDate ? p.targetDate.split('T')[0] : 'N/A'}
                        </td>
                        <td>
                          <button class="btn btn-secondary btn-sm" @click=${() => this.viewProject(p.id)}>
                            Details
                          </button>
                        </td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Upcoming Deadlines -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Upcoming Task Deadlines</span>
              <button
                class="btn btn-outline btn-sm"
                @click=${() =>
                  this.dispatchEvent(
                    new CustomEvent('view-change', {
                      detail: { view: 'kanban' },
                      bubbles: true,
                      composed: true,
                    }),
                  )}
              >
                Go to Kanban
              </button>
            </div>

            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Project</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${upcomingTasks.length === 0
                    ? html`<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No upcoming task deadlines found.</td></tr>`
                    : upcomingTasks.map((t) => {
                        const isOverdue = new Date(t.dueDate!).getTime() < now;
                        const proj = (this.board.projects || []).find((p) => p.id === t.projectId);
                        return html`
                          <tr>
                            <td><strong>${t.title}</strong></td>
                            <td>${proj ? proj.key : 'GENERAL'}</td>
                            <td>
                              <span class="badge badge-${t.priority.toLowerCase()}">
                                ${t.priority}
                              </span>
                            </td>
                            <td>${t.assignee || 'Unassigned'}</td>
                            <td style="font-family: 'Space Mono', monospace; color: ${isOverdue ? '#ff6e78' : 'inherit'}; font-weight: ${isOverdue ? '700' : 'normal'};">
                              ${t.dueDate ? t.dueDate.split('T')[0] : ''} ${isOverdue ? '(OVERDUE)' : ''}
                            </td>
                            <td>
                              <span class="badge badge-status">${t.column}</span>
                            </td>
                          </tr>
                        `;
                      })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Sidebar Activity Feed & Resource Workload -->
        <div class="section-stack">
          <!-- Live Activity Log -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Recent System Activity</span>
              <button
                class="btn btn-outline btn-sm"
                @click=${() =>
                  this.dispatchEvent(
                    new CustomEvent('view-change', {
                      detail: { view: 'audit_logs' },
                      bubbles: true,
                      composed: true,
                    }),
                  )}
              >
                Audit Trail
              </button>
            </div>

            <div class="activity-feed">
              ${recentActivities.length === 0
                ? html`<p style="font-size: 0.8125rem; color: var(--text-muted);">No activity recorded yet.</p>`
                : recentActivities.map(
                    (act) => html`
                      <div class="activity-item">
                        <div class="activity-meta">
                          <span><strong>${act.userName}</strong> (${act.userRole})</span>
                          <span>${act.timestamp ? act.timestamp.split('T')[1].slice(0, 5) : ''}</span>
                        </div>
                        <div class="activity-text">${act.details}</div>
                      </div>
                    `,
                  )}
            </div>
          </div>

          <!-- Team Workload Quick Overview -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Team Capacity Overview</span>
            </div>

            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Active Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  ${capacityUsers.map((u) => {
                    const activeCount = (this.board.tasks || []).filter(
                      (t) =>
                        (t.assigneeId === u.id || t.assignee === u.name) &&
                        t.column.toLowerCase() !== 'done',
                    ).length;
                    return html`
                      <tr>
                        <td><strong>${u.name}</strong></td>
                        <td><span class="badge badge-role">${u.role}</span></td>
                        <td style="font-family: 'Space Mono', monospace; font-weight: 700;">
                          ${activeCount}
                        </td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
