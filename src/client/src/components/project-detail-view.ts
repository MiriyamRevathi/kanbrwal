import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Project, Task, User, RiskAssessment } from '../types.js';
import { fetchProjectRisk } from '../api.js';

@customElement('project-detail-view')
export class ProjectDetailView extends LitElement {
  @property({ type: Object }) project: Project | null = null;
  @property({ type: Array }) tasks: Task[] = [];
  @property({ type: Object }) currentUser: User | null = null;

  @state() private riskAssessment: RiskAssessment | null = null;
  @state() private loadingRisk = false;

  static styles = [
    commonStyles,
    css`
      :host {
        display: block;
        padding: 1.5rem;
        overflow-y: auto;
        height: 100%;
      }

      .detail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
      }

      .header-title-block {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .project-key {
        font-family: 'Space Mono', monospace;
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--primary);
        background: var(--surface-secondary);
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        border: 1px solid var(--border-subtle);
      }

      .detail-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 1.5rem;
      }

      @media (max-width: 1024px) {
        .detail-grid {
          grid-template-columns: 1fr;
        }
      }

      .section-stack {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .risk-meter {
        width: 100%;
        height: 8px;
        background: var(--surface-secondary);
        border-radius: 4px;
        overflow: hidden;
        margin: 0.75rem 0;
      }

      .risk-meter-fill {
        height: 100%;
        border-radius: 4px;
      }

      .fill-high { background: #ff5252; }
      .fill-medium { background: #ffaa33; }
      .fill-low { background: #4cd987; }

      .bullet-list {
        list-style: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        margin-top: 0.5rem;
      }

      .bullet-item {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        padding-left: 1rem;
        position: relative;
        line-height: 1.35;
      }

      .bullet-item::before {
        content: "•";
        position: absolute;
        left: 0;
        color: var(--primary);
        font-weight: bold;
      }
    `,
  ];

  async connectedCallback() {
    super.connectedCallback();
    if (this.project) {
      this.loadRisk();
    }
  }

  private async loadRisk() {
    if (!this.project) return;
    this.loadingRisk = true;
    try {
      this.riskAssessment = await fetchProjectRisk(this.project.id);
    } catch {
      // ignore
    } finally {
      this.loadingRisk = false;
    }
  }

  private backToProjects() {
    this.dispatchEvent(
      new CustomEvent('view-change', {
        detail: { view: 'projects' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private openKanban() {
    this.dispatchEvent(
      new CustomEvent('view-change', {
        detail: { view: 'kanban', projectId: this.project?.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private openTask(task: Task) {
    this.dispatchEvent(
      new CustomEvent('task-select', {
        detail: { task },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    if (!this.project) {
      return html`
        <div class="card">
          <p>No project selected.</p>
          <button class="btn btn-outline" @click=${this.backToProjects}>Back to Projects</button>
        </div>
      `;
    }

    const p = this.project;
    const projectTasks = this.tasks.filter((t) => t.projectId === p.id);
    const completedTasks = projectTasks.filter((t) => t.column.toLowerCase() === 'done').length;
    const completionPct =
      projectTasks.length === 0 ? 100 : Math.round((completedTasks / projectTasks.length) * 100);

    const actualHours = projectTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
    const estimatedHours = projectTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

    const risk = this.riskAssessment;
    const riskLevel = risk?.riskLevel || p.riskLevel || 'low';
    const riskScore = risk?.riskScore ?? p.riskScore ?? 0;

    return html`
      <div class="detail-header">
        <div>
          <div class="header-title-block">
            <button class="btn btn-outline btn-sm" @click=${this.backToProjects}>
              Back to Projects
            </button>
            <span class="project-key">${p.key}</span>
            <h2>${p.name}</h2>
            <span class="badge badge-${p.priority.toLowerCase()}">${p.priority}</span>
            <span class="badge badge-risk-${riskLevel}">${riskLevel} RISK</span>
          </div>
          <p style="margin-top: 0.25rem;">
            Managed by <strong>${p.managerName || 'Unassigned'}</strong> • Target: ${p.targetDate ? p.targetDate.split('T')[0] : 'N/A'}
          </p>
        </div>

        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-primary" @click=${this.openKanban}>
            Open in Kanban Board
          </button>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-label">Tasks Progress</span>
          <span class="stat-value">${completionPct}%</span>
          <span class="stat-helper">${completedTasks} of ${projectTasks.length} Completed</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Budget Utilization</span>
          <span class="stat-value">${actualHours} / ${p.budgetHours || estimatedHours}h</span>
          <span class="stat-helper">${Math.round((actualHours / (p.budgetHours || 1)) * 100)}% Consumed</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">ML Risk Score</span>
          <span class="stat-value" style="color: ${riskLevel === 'high' ? '#ff6e78' : riskLevel === 'medium' ? '#ffaa33' : '#55db90'};">
            ${riskScore}/100
          </span>
          <span class="stat-helper">Confidence: ${risk?.confidence || 85}%</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Schedule Proximity</span>
          <span class="stat-value" style="font-size: 1.2rem;">
            ${risk?.metrics.daysRemaining !== undefined ? `${risk.metrics.daysRemaining} Days Left` : 'Active'}
          </span>
          <span class="stat-helper">${risk?.metrics.overdueTasks || 0} Overdue Items</span>
        </div>
      </div>

      <div class="detail-grid">
        <div class="section-stack">
          <!-- Project Overview & Scope -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Project Scope & Description</span>
            </div>
            <p style="font-size: 0.875rem; line-height: 1.6; color: var(--text-primary);">
              ${p.description || 'No detailed scope document provided.'}
            </p>
          </div>

          <!-- Project Tasks Table -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Project Deliverables (${projectTasks.length} Tasks)</span>
              <button class="btn btn-secondary btn-sm" @click=${this.openKanban}>
                View on Board
              </button>
            </div>

            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Column</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>Due Date</th>
                    <th>Hours (Act/Est)</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  ${projectTasks.length === 0
                    ? html`<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No tasks assigned to this project yet.</td></tr>`
                    : projectTasks.map(
                        (t) => html`
                          <tr style="cursor: pointer;" @click=${() => this.openTask(t)}>
                            <td><strong>${t.title}</strong></td>
                            <td><span class="badge badge-status">${t.column}</span></td>
                            <td><span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span></td>
                            <td>${t.assignee || 'Unassigned'}</td>
                            <td style="font-family: 'Space Mono', monospace; font-size: 0.75rem;">
                              ${t.dueDate ? t.dueDate.split('T')[0] : 'N/A'}
                            </td>
                            <td style="font-family: 'Space Mono', monospace; font-size: 0.75rem;">
                              ${t.actualHours || 0}h / ${t.estimatedHours || 0}h
                            </td>
                            <td><span class="badge badge-risk-${t.riskLevel || 'low'}">${t.riskLevel || 'low'}</span></td>
                          </tr>
                        `,
                      )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ML Risk Engine Breakdown Sidebar -->
        <div class="section-stack">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Local ML Project Risk Engine</span>
              <span class="badge badge-risk-${riskLevel}">${riskLevel}</span>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                <span>Risk Severity Index</span>
                <strong>${riskScore}/100</strong>
              </div>
              <div class="risk-meter">
                <div
                  class="risk-meter-fill fill-${riskLevel}"
                  style="width: ${riskScore}%;"
                ></div>
              </div>
            </div>

            <div style="margin-top: 1rem;">
              <h4 style="font-size: 0.8125rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em;">
                Identified Risk Vectors
              </h4>
              <ul class="bullet-list">
                ${(risk?.riskFactors || p.riskFactors || ['Nominal parameters']).map(
                  (f) => html`<li class="bullet-item">${f}</li>`,
                )}
              </ul>
            </div>

            <div style="margin-top: 1.25rem;">
              <h4 style="font-size: 0.8125rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em;">
                AI & ML Recommendations
              </h4>
              <ul class="bullet-list">
                ${(risk?.recommendations || [
                  'Maintain continuous velocity monitoring and automated testing.',
                ]).map((r) => html`<li class="bullet-item" style="color: var(--text-primary);">${r}</li>`)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
