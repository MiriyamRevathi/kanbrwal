import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Board, User } from '../types.js';

@customElement('analytics-dashboard')
export class AnalyticsDashboard extends LitElement {
  @property({ type: Object }) board: Board | null = null;
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

      .evm-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .evm-card {
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .evm-title {
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-muted);
        letter-spacing: 0.05em;
      }

      .evm-value {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .evm-subtitle {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
    `,
  ];

  render() {
    const projects = this.board?.projects || [];
    const tasks = this.board?.tasks || [];
    const timesheets = this.board?.timesheets || [];

    const totalBudgetHours = projects.reduce((sum, p) => sum + (p.budgetHours || 500), 0);
    const totalLoggedHours = timesheets.reduce((sum, ts) => sum + ts.hours, 0);
    const completedTasksCount = tasks.filter((t) => t.column.toLowerCase() === 'done').length;

    const overallEV = Math.round((completedTasksCount / Math.max(1, tasks.length)) * totalBudgetHours);
    const cpi = totalLoggedHours > 0 ? (overallEV / totalLoggedHours).toFixed(2) : '1.00';

    return html`
      <div class="header-actions">
        <div>
          <h1>Earned Value &amp; Financial Analytics</h1>
          <p>EVM metrics, labor cost variance, schedule performance index, and effort accounting</p>
        </div>
      </div>

      <div class="evm-grid">
        <div class="evm-card">
          <span class="evm-title">Total Budgeted Hours (BAC)</span>
          <span class="evm-value">${totalBudgetHours}h</span>
          <span class="evm-subtitle">Across ${projects.length} enterprise projects</span>
        </div>

        <div class="evm-card">
          <span class="evm-title">Earned Value (EV)</span>
          <span class="evm-value">${overallEV}h</span>
          <span class="evm-subtitle">Based on verified task completion</span>
        </div>

        <div class="evm-card">
          <span class="evm-title">Actual Hours Logged (AC)</span>
          <span class="evm-value">${totalLoggedHours}h</span>
          <span class="evm-subtitle">From logged employee timesheets</span>
        </div>

        <div class="evm-card">
          <span class="evm-title">Cost Performance Index (CPI)</span>
          <span class="evm-value" style="color: ${Number(cpi) >= 1 ? 'var(--success-text)' : 'var(--danger-text)'}">
            ${cpi}
          </span>
          <span class="evm-subtitle">${Number(cpi) >= 1 ? 'Under Budget / Efficient' : 'Over Budget Variance'}</span>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom: 1rem;">Project Portfolio Performance Breakdown</h3>
        <table class="table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--surface-secondary); text-align: left; font-size: 0.75rem; text-transform: uppercase;">
              <th style="padding: 0.65rem;">Key</th>
              <th style="padding: 0.65rem;">Project Name</th>
              <th style="padding: 0.65rem;">Status</th>
              <th style="padding: 0.65rem;">Budget Hours</th>
              <th style="padding: 0.65rem;">Completion</th>
              <th style="padding: 0.65rem;">Risk Score</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map((p) => {
              const pTasks = tasks.filter((t) => t.projectId === p.id);
              const pDone = pTasks.filter((t) => t.column.toLowerCase() === 'done').length;
              const pct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
              return html`
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 0.65rem;"><strong>${p.key}</strong></td>
                  <td style="padding: 0.65rem;">${p.name}</td>
                  <td style="padding: 0.65rem;"><span class="badge badge-status">${p.status}</span></td>
                  <td style="padding: 0.65rem;">${p.budgetHours || 500}h</td>
                  <td style="padding: 0.65rem;">${pct}%</td>
                  <td style="padding: 0.65rem;"><span class="badge badge-${p.riskLevel === 'high' ? 'risk-high' : 'risk-medium'}">${p.riskScore}/100</span></td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }
}
