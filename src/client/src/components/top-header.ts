import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { User, Project } from '../types.js';

@customElement('top-header')
export class TopHeader extends LitElement {
  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: Array }) projects: Project[] = [];
  @property({ type: String }) selectedProjectId = 'all';
  @property({ type: Boolean }) connected = false;
  @property({ type: Number }) unreadCount = 0;
  @property({ type: String }) theme: 'light' | 'dark' = 'dark';

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      min-height: 56px;
      padding: 0 1.5rem;
      background: var(--surface-primary);
      border-bottom: 1px solid var(--border-subtle);
      user-select: none;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .project-picker {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .picker-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .project-select {
      background: var(--input-bg);
      color: var(--text-primary);
      border: 1px solid var(--border-default);
      border-radius: 4px;
      padding: 0.35rem 0.65rem;
      font-size: 0.8125rem;
      font-family: inherit;
      outline: none;
      cursor: pointer;
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.6875rem;
      font-weight: 600;
      font-family: 'Space Mono', monospace;
      padding: 0.2rem 0.5rem;
      border-radius: 3px;
    }

    .status-connected {
      background: #0d2b1b;
      color: #55db90;
      border: 1px solid #175435;
    }

    .status-disconnected {
      background: #361014;
      color: #ff6e78;
      border: 1px solid #6e2029;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .user-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .user-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .user-role-badge {
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
    }

    .btn-header {
      padding: 0.35rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      font-family: inherit;
      border-radius: 4px;
      background: var(--surface-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-default);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-header:hover {
      background: var(--surface-hover);
      border-color: var(--border-focus);
    }

    .btn-danger-outline {
      background: transparent;
      color: var(--danger-text);
      border-color: var(--danger-border);
    }

    .btn-danger-outline:hover {
      background: var(--danger-bg);
    }

    .notif-pill {
      font-size: 0.6875rem;
      background: var(--primary);
      color: #fff;
      padding: 0.1rem 0.35rem;
      border-radius: 8px;
      margin-left: 0.25rem;
    }
  `;

  private onProjectChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    this.dispatchEvent(
      new CustomEvent('project-select', {
        detail: { projectId: target.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private toggleTheme() {
    this.dispatchEvent(
      new CustomEvent('theme-toggle', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleLogout() {
    this.dispatchEvent(
      new CustomEvent('logout-request', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private openNotifications() {
    this.dispatchEvent(
      new CustomEvent('view-change', {
        detail: { view: 'notifications' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private formatRole(role?: string): string {
    if (!role) return 'USER';
    return role.replace(/_/g, ' ').toUpperCase();
  }

  render() {
    return html`
      <div class="header-left">
        <div class="project-picker">
          <span class="picker-label">Active Project:</span>
          <select class="project-select" .value=${this.selectedProjectId} @change=${this.onProjectChange}>
            <option value="all">All Enterprise Projects</option>
            ${this.projects.map(
              (p) => html`<option value=${p.id}>[${p.key}] ${p.name}</option>`,
            )}
          </select>
        </div>

        <div class="status-indicator ${this.connected ? 'status-connected' : 'status-disconnected'}">
          ${this.connected ? 'LIVE SSE' : 'DISCONNECTED'}
        </div>
      </div>

      <div class="header-right">
        <button class="btn-header" @click=${this.openNotifications}>
          Notifications ${this.unreadCount > 0 ? html`<span class="notif-pill">${this.unreadCount}</span>` : ''}
        </button>

        <button class="btn-header" @click=${this.toggleTheme}>
          Theme: ${this.theme === 'dark' ? 'Dark' : 'Light'}
        </button>

        ${this.currentUser
          ? html`
              <div class="user-profile">
                <div class="user-info">
                  <span class="user-name">${this.currentUser.name}</span>
                  <span class="user-role-badge">${this.formatRole(this.currentUser.role)}</span>
                </div>
                <button class="btn-header btn-danger-outline" @click=${this.handleLogout}>
                  Sign Out
                </button>
              </div>
            `
          : ''}
      </div>
    `;
  }
}
