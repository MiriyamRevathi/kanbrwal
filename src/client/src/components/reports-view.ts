import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Board, User } from '../types.js';
import { getExportUrl } from '../api.js';

@customElement('reports-view')
export class ReportsView extends LitElement {
  @property({ type: Object }) board!: Board;
  @property({ type: Object }) currentUser: User | null = null;

  static styles = [
    commonStyles,
    css`
      :host {
        display: block;
        padding: 1.5rem;
        overflow-y: auto;
        height: 100%;
      }

      .header-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
      }

      .export-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .export-card {
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .export-title {
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .export-desc {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }

      .btn-row {
        display: flex;
        gap: 0.5rem;
      }
    `,
  ];

  render() {
    const projects = this.board.projects || [];
    const tasks = this.board.tasks || [];
    const users = this.board.users || [];
    const timesheets = this.board.timesheets || [];

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.column.toLowerCase() === 'done').length;
    const blockedTasks = tasks.filter((t) => t.column.toLowerCase() === 'blocked').length;
    const overdueTasks = tasks.filter((t) => {
      if (!t.dueDate || t.column.toLowerCase() === 'done') return false;
      return new Date(t.dueDate).getTime() < Date.now();
    }).length;

    return html`
      <div class="header-actions">
        <div>
          <h1>Enterprise Reports & Data Export</h1>
          <p>Portfolio analytics, delivery metrics, resource utilization, and raw data extraction</p>
        </div>
      </div>

      <!-- Quick Export Panels -->
      <div class="export-grid">
        <div class="export-card">
          <div>
            <div class="export-title">Tasks & Deliverables</div>
            <div class="export-desc">Full task registry, columns, risk ratings, and estimation metrics.</div>
          </div>
          <div class="btn-row">
            <a class="btn btn-outline btn-sm" href=${getExportUrl('csv', 'tasks')} target="_blank">
              Export CSV
            </a>
            <a class="btn btn-outline btn-sm" href=${getExportUrl('json', 'tasks')} target="_blank">
              Export JSON
            </a>
          </div>
        </div>

        <div class="export-card">
          <div>
            <div class="export-title">Projects Portfolio</div>
            <div class="export-desc">Project roadmaps, status health, manager assignments, and budgets.</div>
          </div>
          <div class="btn-row">
            <a class="btn btn-outline btn-sm" href=${getExportUrl('csv', 'projects')} target="_blank">
              Export CSV
            </a>
            <a class="btn btn-outline btn-sm" href=${getExportUrl('json', 'projects')} target="_blank">
              Export JSON
            </a>
          </div>
        </div>

        <div class="export-card">
          <div>
            <div class="export-title">Timesheets & Labor Hours</div>
            <div class="export-desc">Logged effort records, project breakdowns, and employee hours.</div>
          </div>
          <div class="btn-row">
            <a class="btn btn-outline btn-sm" href=${getExportUrl('csv', 'timesheets')} target="_blank">
              Export CSV
            </a>
            <a class="btn btn-outline btn-sm" href=${getExportUrl('json', 'timesheets')} target="_blank">
              Export JSON
            </a>
          </div>
        </div>

        <div class="export-card">
          <div>
            <div class="export-title">System Audit Trail</div>
            <div class="export-desc">Compliance logs, mutation records, and user security events.</div>
          </div>
          <div class="btn-row">
            <a class="btn btn-outline btn-sm" href=${getExportUrl('csv', 'activities')} target="_blank">
              Export CSV
            </a>
            <a class="btn btn-outline btn-sm" href=${getExportUrl('json', 'activities')} target="_blank">
              Export JSON
            </a>
          </div>
        </div>
      </div>

      <!-- Project Progress Breakdown -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <span class="card-title">Portfolio Performance Breakdown</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Priority</th>
                <th>Total Tasks</th>
                <th>Completed</th>
                <th>Blocked</th>
                <th>Overdue</th>
                <th>Labor Hours (Act / Budg)</th>
                <th>ML Risk Level</th>
              </tr>
            </thead>
            <tbody>
              ${projects.map((p) => {
                const pTasks = tasks.filter((t) => t.projectId === p.id);
                const pDone = pTasks.filter((t) => t.column.toLowerCase() === 'done').length;
                const pBlocked = pTasks.filter((t) => t.column.toLowerCase() === 'blocked').length;
                const pOverdue = pTasks.filter((t) => {
                  if (!t.dueDate || t.column.toLowerCase() === 'done') return false;
                  return new Date(t.dueDate).getTime() < Date.now();
                }).length;
                const actHours = pTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

                return html`
                  <tr>
                    <td><strong>[${p.key}]</strong> ${p.name}</td>
                    <td><span class="badge badge-${p.priority.toLowerCase()}">${p.priority}</span></td>
                    <td style="font-family: 'Space Mono', monospace;">${pTasks.length}</td>
                    <td style="font-family: 'Space Mono', monospace; color: #55db90;">${pDone}</td>
                    <td style="font-family: 'Space Mono', monospace; color: ${pBlocked > 0 ? '#ffaa33' : 'inherit'};">
                      ${pBlocked}
                    </td>
                    <td style="font-family: 'Space Mono', monospace; color: ${pOverdue > 0 ? '#ff6e78' : 'inherit'};">
                      ${pOverdue}
                    </td>
                    <td style="font-family: 'Space Mono', monospace;">
                      ${actHours}h / ${p.budgetHours}h
                    </td>
                    <td><span class="badge badge-risk-${p.riskLevel}">${p.riskLevel}</span></td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Resource Utilization -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Team Workload & Effort Ledger</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Employee / Member</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Assigned Tasks</th>
                <th>Completed Tasks</th>
                <th>Active Workload</th>
                <th>Total Hours Logged</th>
              </tr>
            </thead>
            <tbody>
              ${users.map((u) => {
                const uTasks = tasks.filter((t) => t.assigneeId === u.id || t.assignee === u.name);
                const uDone = uTasks.filter((t) => t.column.toLowerCase() === 'done').length;
                const uActive = uTasks.length - uDone;
                const uHours = timesheets
                  .filter((ts) => ts.userId === u.id)
                  .reduce((sum, ts) => sum + ts.hours, 0);

                return html`
                  <tr>
                    <td><strong>${u.name}</strong></td>
                    <td><span class="badge badge-role">${u.role}</span></td>
                    <td>${u.title || 'Member'}</td>
                    <td style="font-family: 'Space Mono', monospace;">${uTasks.length}</td>
                    <td style="font-family: 'Space Mono', monospace; color: #55db90;">${uDone}</td>
                    <td style="font-family: 'Space Mono', monospace; font-weight: 700;">${uActive}</td>
                    <td style="font-family: 'Space Mono', monospace;">${uHours.toFixed(1)} Hours</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
