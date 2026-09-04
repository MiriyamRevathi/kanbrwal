import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ActiveView, User } from '../types.js';

@customElement('nav-sidebar')
export class NavSidebar extends LitElement {
  @property({ type: String }) activeView: ActiveView = 'dashboard';
  @property({ type: Object }) currentUser: User | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 240px;
      min-width: 240px;
      height: 100%;
      background: var(--surface-primary);
      border-right: 1px solid var(--border-subtle);
      user-select: none;
    }

    .brand-section {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .brand-title {
      font-size: 0.9375rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-primary);
      text-transform: uppercase;
    }

    .brand-subtitle {
      font-size: 0.6875rem;
      color: var(--text-muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem 0.75rem;
      flex: 1;
      overflow-y: auto;
    }

    .nav-section-title {
      font-size: 0.6875rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 0.5rem 0.75rem 0.25rem;
      margin-top: 0.5rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-secondary);
      background: transparent;
      border: 1px solid transparent;
      cursor: pointer;
      text-align: left;
      width: 100%;
      transition: all 0.15s ease;
      font-family: inherit;
    }

    .nav-item:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
      border-color: var(--border-subtle);
    }

    .nav-item.active {
      background: var(--surface-secondary);
      color: var(--text-primary);
      font-weight: 600;
      border-color: var(--border-default);
      border-left: 3px solid var(--primary);
    }

    .nav-badge {
      font-size: 0.6875rem;
      padding: 0.1rem 0.4rem;
      border-radius: 10px;
      background: var(--surface-secondary);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
      font-family: 'Space Mono', monospace;
    }

    .sidebar-footer {
      padding: 1rem;
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-secondary);
      font-size: 0.6875rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .footer-pill {
      display: inline-block;
      font-family: 'Space Mono', monospace;
      color: var(--text-secondary);
    }
  `;

  private selectView(view: ActiveView) {
    this.dispatchEvent(
      new CustomEvent('view-change', {
        detail: { view },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const role = this.currentUser?.role;
    const isOrgAdmin = role === 'org_admin';
    const isPM = role === 'project_manager';
    const isLead = role === 'team_lead';

    // Users directory: only shown to Org Admin
    const canViewUsers = isOrgAdmin;
    // Teams: shown to Org Admin, PM, and team lead
    const canViewTeams = isOrgAdmin || isPM || isLead;
    const canViewAudit = isOrgAdmin || isPM;
    // Settings: only Org Admin
    const canViewSettings = isOrgAdmin;

    return html`
      <div class="brand-section">
        <div class="brand-title">Kanbrawl</div>
        <div class="brand-subtitle">Enterprise Workspace</div>
      </div>

      <div class="nav-list">
        <div class="nav-section-title">Core Management</div>

        <button
          class="nav-item ${this.activeView === 'dashboard' ? 'active' : ''}"
          @click=${() => this.selectView('dashboard')}
        >
          <span>Dashboard</span>
        </button>

        <button
          class="nav-item ${this.activeView === 'projects' || this.activeView === 'project_details' ? 'active' : ''}"
          @click=${() => this.selectView('projects')}
        >
          <span>Projects</span>
        </button>

        <button
          class="nav-item ${this.activeView === 'kanban' ? 'active' : ''}"
          @click=${() => this.selectView('kanban')}
        >
          <span>Kanban Board</span>
        </button>

        <button
          class="nav-item ${this.activeView === 'calendar' ? 'active' : ''}"
          @click=${() => this.selectView('calendar')}
        >
          <span>Calendar</span>
        </button>

        <div class="nav-section-title">Operations &amp; Tracking</div>

        <button
          class="nav-item ${this.activeView === 'time_tracking' ? 'active' : ''}"
          @click=${() => this.selectView('time_tracking')}
        >
          <span>Time Tracking</span>
        </button>

        <button
          class="nav-item ${this.activeView === 'reports' ? 'active' : ''}"
          @click=${() => this.selectView('reports')}
        >
          <span>Reports &amp; Export</span>
        </button>

        ${canViewUsers || canViewTeams
          ? html`
              <div class="nav-section-title">Organization &amp; Team</div>

              ${canViewUsers
                ? html`
                    <button
                      class="nav-item ${this.activeView === 'users' ? 'active' : ''}"
                      @click=${() => this.selectView('users')}
                    >
                      <span>Users</span>
                    </button>
                  `
                : ''}

              ${canViewTeams
                ? html`
                    <button
                      class="nav-item ${this.activeView === 'teams' ? 'active' : ''}"
                      @click=${() => this.selectView('teams')}
                    >
                      <span>Teams</span>
                    </button>
                  `
                : ''}
            `
          : ''}

        <div class="nav-section-title">System &amp; Governance</div>

        ${canViewAudit
          ? html`
              <button
                class="nav-item ${this.activeView === 'audit_logs' ? 'active' : ''}"
                @click=${() => this.selectView('audit_logs')}
              >
                <span>Audit Logs</span>
              </button>
            `
          : ''}

        <button
          class="nav-item ${this.activeView === 'notifications' ? 'active' : ''}"
          @click=${() => this.selectView('notifications')}
        >
          <span>Notifications</span>
        </button>

        ${canViewSettings
          ? html`
              <button
                class="nav-item ${this.activeView === 'settings' ? 'active' : ''}"
                @click=${() => this.selectView('settings')}
              >
                <span>Settings</span>
              </button>
            `
          : ''}
      </div>

      <div class="sidebar-footer">
        <div>Storage: <span class="footer-pill">JSON / File-based</span></div>
        <div>AI MCP: <span class="footer-pill">Active on /mcp</span></div>
      </div>
    `;
  }
}
