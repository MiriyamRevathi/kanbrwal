import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Activity, User } from '../types.js';

@customElement('audit-view')
export class AuditView extends LitElement {
  @property({ type: Array }) activities: Activity[] = [];
  @property({ type: Object }) currentUser: User | null = null;

  @state() private searchFilter = '';
  @state() private actionFilter = 'all';

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
    `,
  ];

  render() {
    let list = this.activities;

    if (this.actionFilter !== 'all') {
      list = list.filter((a) => a.action === this.actionFilter);
    }

    if (this.searchFilter.trim()) {
      const q = this.searchFilter.toLowerCase();
      list = list.filter(
        (a) =>
          a.userName.toLowerCase().includes(q) ||
          a.details.toLowerCase().includes(q) ||
          a.action.toLowerCase().includes(q) ||
          (a.targetTitle && a.targetTitle.toLowerCase().includes(q)),
      );
    }

    return html`
      <div class="header-actions">
        <div>
          <h1>Enterprise Audit Trail & Compliance Log</h1>
          <p>Chronological immutable record of security events, mutations, and user activities</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="filter-item" style="flex: 1; min-width: 200px;">
          <span class="filter-label">Search:</span>
          <input
            type="text"
            class="form-input"
            style="padding: 0.35rem 0.65rem;"
            placeholder="Search audit records..."
            .value=${this.searchFilter}
            @input=${(e: Event) => (this.searchFilter = (e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="filter-item">
          <span class="filter-label">Action Category:</span>
          <select
            class="form-select"
            style="padding: 0.35rem 0.65rem; width: auto;"
            .value=${this.actionFilter}
            @change=${(e: Event) => (this.actionFilter = (e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Actions</option>
            <option value="task_moved">Task Moved</option>
            <option value="task_created">Task Created</option>
            <option value="task_updated">Task Updated</option>
            <option value="task_deleted">Task Deleted</option>
            <option value="project_created">Project Created</option>
            <option value="project_updated">Project Updated</option>
            <option value="time_logged">Time Logged</option>
            <option value="login">User Login</option>
            <option value="user_created">User Provisioned</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Target Resource</th>
                <th>Detailed Event Description</th>
              </tr>
            </thead>
            <tbody>
              ${list.length === 0
                ? html`<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No audit logs match criteria.</td></tr>`
                : list.map(
                    (act) => html`
                      <tr>
                        <td style="font-family: 'Space Mono', monospace; font-size: 0.75rem; white-space: nowrap;">
                          ${act.timestamp ? act.timestamp.replace('T', ' ').slice(0, 19) : ''}
                        </td>
                        <td><strong>${act.userName}</strong></td>
                        <td><span class="badge badge-role">${act.userRole}</span></td>
                        <td><span class="badge badge-status">${act.action}</span></td>
                        <td>${act.targetTitle || act.targetType}</td>
                        <td style="color: var(--text-primary); font-size: 0.8125rem;">
                          ${act.details}
                        </td>
                      </tr>
                    `,
                  )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
