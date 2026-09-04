import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Notification, User, Team, Project, Task, NotificationType, NotificationPriority } from '../types.js';
import { markNotificationRead, sendNotification } from '../api.js';

@customElement('notifications-view')
export class NotificationsView extends LitElement {
  @property({ type: Array }) notifications: Notification[] = [];
  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: Array }) teams: Team[] = [];
  @property({ type: Array }) projects: Project[] = [];
  @property({ type: Array }) tasks: Task[] = [];
  @property({ type: Array }) users: User[] = [];

  // Filter state
  @state() private activeFilter: 'all' | 'unread' | 'system' | 'manual' | 'important' | 'urgent' = 'all';

  // Send Notification Modal State
  @state() private showSendModal = false;
  @state() private formRecipient = 'all';
  @state() private formType: NotificationType = 'announcement';
  @state() private formTitle = '';
  @state() private formMessage = '';
  @state() private formPriority: NotificationPriority = 'normal';
  @state() private formProjectId = '';
  @state() private formTaskId = '';
  @state() private formError = '';
  @state() private submitting = false;
  @state() private successMsg = '';

  // Detail Modal State
  @state() private selectedNotification: Notification | null = null;

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
        gap: 1rem;
        flex-wrap: wrap;
      }

      .filter-tabs {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
      }

      .filter-tab {
        padding: 0.4rem 0.85rem;
        font-size: 0.75rem;
        font-weight: 600;
        border-radius: 4px;
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .filter-tab:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }

      .filter-tab.active {
        background: var(--surface-secondary);
        color: var(--primary);
        border-color: var(--primary);
      }

      .notif-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .notif-card {
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        padding: 1rem 1.25rem;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        transition: border-color 0.15s ease, background 0.15s ease;
        cursor: pointer;
      }

      .notif-card:hover {
        border-color: var(--border-default);
        background: var(--surface-hover);
      }

      .notif-card.unread {
        border-left: 4px solid var(--primary);
        background: var(--surface-secondary);
      }

      .notif-main {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        flex: 1;
      }

      .notif-meta-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .notif-title {
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .notif-msg {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        line-height: 1.45;
      }

      .notif-sender {
        font-size: 0.75rem;
        color: var(--text-muted);
        font-style: italic;
      }

      .notif-time {
        font-size: 0.6875rem;
        color: var(--text-muted);
        font-family: 'Space Mono', monospace;
      }

      .badge-source-manual {
        background: var(--primary);
        color: white;
        font-weight: 700;
        font-size: 0.625rem;
        padding: 0.15rem 0.4rem;
        border-radius: 3px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .badge-source-system {
        background: var(--surface-secondary);
        color: var(--text-muted);
        border: 1px solid var(--border-subtle);
        font-weight: 600;
        font-size: 0.625rem;
        padding: 0.15rem 0.4rem;
        border-radius: 3px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .badge-priority-urgent {
        background: var(--danger-bg);
        color: var(--danger-text);
        border: 1px solid var(--danger-border);
        font-weight: 700;
      }

      .badge-priority-important {
        background: rgba(255, 171, 0, 0.15);
        color: #ffab00;
        border: 1px solid rgba(255, 171, 0, 0.3);
        font-weight: 700;
      }

      .badge-priority-normal {
        background: var(--surface-secondary);
        color: var(--text-secondary);
      }

      .detail-row {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 1rem;
      }

      .detail-label {
        font-size: 0.6875rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .detail-val {
        font-size: 0.875rem;
        color: var(--text-primary);
      }
    `,
  ];

  private canSendNotification(): boolean {
    const role = this.currentUser?.role;
    return role === 'org_admin' || role === 'project_manager' || role === 'team_lead';
  }

  private openSendModal() {
    this.formRecipient = 'all';
    this.formType = 'announcement';
    this.formTitle = '';
    this.formMessage = '';
    this.formPriority = 'normal';
    this.formProjectId = '';
    this.formTaskId = '';
    this.formError = '';
    this.showSendModal = true;
  }

  private async handleSendSubmit(e: Event) {
    e.preventDefault();
    if (!this.formTitle.trim()) {
      this.formError = 'Notification title is required.';
      return;
    }
    if (!this.formMessage.trim()) {
      this.formError = 'Notification message content is required.';
      return;
    }

    this.submitting = true;
    this.formError = '';

    try {
      await sendNotification({
        recipient: this.formRecipient,
        title: this.formTitle.trim(),
        message: this.formMessage.trim(),
        type: this.formType,
        priority: this.formPriority,
        projectId: this.formProjectId || undefined,
        taskId: this.formTaskId || undefined,
      });

      this.successMsg = 'Notification sent successfully!';
      setTimeout(() => (this.successMsg = ''), 4000);
      this.showSendModal = false;

      this.dispatchEvent(
        new CustomEvent('notification-sent', {
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this.formError = err instanceof Error ? err.message : 'Failed to send notification.';
    } finally {
      this.submitting = false;
    }
  }

  private async markRead(e: Event, id: string) {
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      this.dispatchEvent(
        new CustomEvent('notification-read', {
          detail: { id },
          bubbles: true,
          composed: true,
        }),
      );
    } catch {
      // ignore
    }
  }

  private viewNotificationDetail(n: Notification) {
    this.selectedNotification = n;
    if (!n.read) {
      this.markRead(new Event('click'), n.id);
    }
  }

  render() {
    const isLead = this.currentUser?.role === 'team_lead';

    // Base filtering for team leads
    let baseList = this.notifications;
    if (isLead) {
      const myTeam = this.teams.find(
        (t) =>
          t.leadId === this.currentUser?.id ||
          (t.memberIds || []).includes(this.currentUser?.id || ''),
      );
      const teamMemberIds = myTeam ? myTeam.memberIds || [] : [];
      if (teamMemberIds.length > 0) {
        baseList = baseList.filter(
          (n) =>
            n.userId === this.currentUser?.id ||
            n.userId === 'all' ||
            n.userId === 'team_lead' ||
            teamMemberIds.includes(n.userId),
        );
      }
    }

    // Active filter application
    const filteredList = baseList.filter((n) => {
      if (this.activeFilter === 'unread') return !n.read;
      if (this.activeFilter === 'manual') return n.source === 'manual';
      if (this.activeFilter === 'system') return n.source !== 'manual';
      if (this.activeFilter === 'important') return n.priority === 'important';
      if (this.activeFilter === 'urgent') return n.priority === 'urgent' || n.type === 'urgent';
      return true;
    });

    const projectTasks = this.tasks.filter((t) => t.projectId === this.formProjectId);

    return html`
      <div class="header-actions">
        <div>
          <h1>System & Task Notifications</h1>
          <p>Task assignments, upcoming deadlines, risk alerts, and management announcements</p>
        </div>

        ${this.canSendNotification()
          ? html`
              <button class="btn btn-primary" @click=${this.openSendModal}>
                Send Notification
              </button>
            `
          : ''}
      </div>

      ${this.successMsg
        ? html`<div class="alert alert-success" style="margin-bottom: 1.25rem;">${this.successMsg}</div>`
        : ''}

      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button
          class="filter-tab ${this.activeFilter === 'all' ? 'active' : ''}"
          @click=${() => (this.activeFilter = 'all')}
        >
          All (${baseList.length})
        </button>
        <button
          class="filter-tab ${this.activeFilter === 'unread' ? 'active' : ''}"
          @click=${() => (this.activeFilter = 'unread')}
        >
          Unread (${baseList.filter((n) => !n.read).length})
        </button>
        <button
          class="filter-tab ${this.activeFilter === 'manual' ? 'active' : ''}"
          @click=${() => (this.activeFilter = 'manual')}
        >
          Manual Notifications (${baseList.filter((n) => n.source === 'manual').length})
        </button>
        <button
          class="filter-tab ${this.activeFilter === 'system' ? 'active' : ''}"
          @click=${() => (this.activeFilter = 'system')}
        >
          System Notifications (${baseList.filter((n) => n.source !== 'manual').length})
        </button>
        <button
          class="filter-tab ${this.activeFilter === 'important' ? 'active' : ''}"
          @click=${() => (this.activeFilter = 'important')}
        >
          Important
        </button>
        <button
          class="filter-tab ${this.activeFilter === 'urgent' ? 'active' : ''}"
          @click=${() => (this.activeFilter = 'urgent')}
        >
          Urgent
        </button>
      </div>

      <!-- Notifications List -->
      <div class="notif-list">
        ${filteredList.length === 0
          ? html`<div class="card" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">No notifications found for selected filter.</div>`
          : filteredList.map((n) => {
              const isManual = n.source === 'manual';
              return html`
                <div
                  class="notif-card ${n.read ? 'read' : 'unread'}"
                  @click=${() => this.viewNotificationDetail(n)}
                >
                  <div class="notif-main">
                    <div class="notif-meta-row">
                      <span class="${isManual ? 'badge-source-manual' : 'badge-source-system'}">
                        ${isManual ? 'Manual Notification' : 'System Notification'}
                      </span>

                      <span class="badge badge-${n.type === 'alert' || n.type === 'urgent' ? 'risk-high' : n.type === 'warning' || n.type === 'deadline' ? 'risk-medium' : 'status'}">
                        ${(n.type || 'INFO').toUpperCase().replace('_', ' ')}
                      </span>

                      ${n.priority && n.priority !== 'normal'
                        ? html`
                            <span class="badge badge-priority-${n.priority}">
                              ${n.priority.toUpperCase()} PRIORITY
                            </span>
                          `
                        : ''}

                      <span class="notif-title">${n.title}</span>

                      <span class="notif-time" style="margin-left: auto;">
                        ${n.createdAt ? n.createdAt.replace('T', ' ').slice(0, 16) : ''}
                      </span>
                    </div>

                    <div class="notif-msg">${n.message}</div>

                    ${isManual && n.senderName
                      ? html`
                          <div class="notif-sender">
                            Sent by <strong>${n.senderName}</strong> — ${(n.senderRole || 'Manager').replace('_', ' ').toUpperCase()}
                          </div>
                        `
                      : ''}
                  </div>

                  ${!n.read
                    ? html`
                        <button
                          class="btn btn-outline btn-sm"
                          @click=${(e: Event) => this.markRead(e, n.id)}
                        >
                          Mark Read
                        </button>
                      `
                    : ''}
                </div>
              `;
            })}
      </div>

      <!-- Send Notification Modal -->
      ${this.showSendModal
        ? html`
            <div class="modal-overlay" @click=${() => (this.showSendModal = false)}>
              <div class="modal-dialog" style="max-width: 620px;" @click=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                  <h3>Send Manual Notification</h3>
                  <button class="btn btn-outline btn-sm" @click=${() => (this.showSendModal = false)}>
                    Close
                  </button>
                </div>

                <form @submit=${this.handleSendSubmit}>
                  <div class="modal-body">
                    ${this.formError ? html`<div class="alert alert-danger">${this.formError}</div>` : ''}

                    <div class="form-row">
                      <div class="form-group">
                        <label class="form-label">Recipient *</label>
                        <select
                          class="form-select"
                          .value=${this.formRecipient}
                          @change=${(e: Event) => (this.formRecipient = (e.target as HTMLSelectElement).value)}
                          required
                        >
                          <optgroup label="System Roles & Audiences">
                            <option value="all">All Organization Users</option>
                            <option value="org_admin">Organization Admins</option>
                            <option value="project_manager">Project Managers</option>
                            <option value="team_lead">Team Leads</option>
                          </optgroup>
                          <optgroup label="Specific Team Members">
                            ${this.users.map(
                              (u) => html`<option value=${u.id}>${u.name} (${u.role.replace('_', ' ')})</option>`,
                            )}
                          </optgroup>
                        </select>
                      </div>

                      <div class="form-group">
                        <label class="form-label">Notification Type *</label>
                        <select
                          class="form-select"
                          .value=${this.formType}
                          @change=${(e: Event) => (this.formType = (e.target as HTMLSelectElement).value as NotificationType)}
                          required
                        >
                          <option value="announcement">Announcement</option>
                          <option value="info">Information</option>
                          <option value="task_update">Task Update</option>
                          <option value="project_update">Project Update</option>
                          <option value="deadline">Deadline Alert</option>
                          <option value="risk_alert">Risk Alert</option>
                          <option value="urgent">Urgent Notice</option>
                        </select>
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label">Title *</label>
                      <input
                        type="text"
                        class="form-input"
                        .value=${this.formTitle}
                        @input=${(e: Event) => (this.formTitle = (e.target as HTMLInputElement).value)}
                        placeholder="e.g. Project deadline updated for Q3 Sprint"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label">Message *</label>
                      <textarea
                        class="form-textarea"
                        .value=${this.formMessage}
                        @input=${(e: Event) => (this.formMessage = (e.target as HTMLTextAreaElement).value)}
                        placeholder="Detailed notification text and instructions..."
                        style="min-height: 90px;"
                        required
                      ></textarea>
                    </div>

                    <div class="form-row">
                      <div class="form-group">
                        <label class="form-label">Priority</label>
                        <select
                          class="form-select"
                          .value=${this.formPriority}
                          @change=${(e: Event) => (this.formPriority = (e.target as HTMLSelectElement).value as NotificationPriority)}
                        >
                          <option value="normal">Normal Priority</option>
                          <option value="important">Important Priority</option>
                          <option value="urgent">Urgent Priority</option>
                        </select>
                      </div>

                      <div class="form-group">
                        <label class="form-label">Related Project (Optional)</label>
                        <select
                          class="form-select"
                          .value=${this.formProjectId}
                          @change=${(e: Event) => {
                            this.formProjectId = (e.target as HTMLSelectElement).value;
                            this.formTaskId = '';
                          }}
                        >
                          <option value="">-- None --</option>
                          ${this.projects.map(
                            (p) => html`<option value=${p.id}>[${p.key}] ${p.name}</option>`,
                          )}
                        </select>
                      </div>
                    </div>

                    ${this.formProjectId
                      ? html`
                          <div class="form-group">
                            <label class="form-label">Related Task (Optional)</label>
                            <select
                              class="form-select"
                              .value=${this.formTaskId}
                              @change=${(e: Event) => (this.formTaskId = (e.target as HTMLSelectElement).value)}
                            >
                              <option value="">-- None --</option>
                              ${projectTasks.map((t) => html`<option value=${t.id}>${t.title}</option>`)}
                            </select>
                          </div>
                        `
                      : ''}
                  </div>

                  <div class="modal-footer">
                    <button
                      type="button"
                      class="btn btn-outline"
                      @click=${() => (this.showSendModal = false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="btn btn-primary"
                      ?disabled=${this.submitting}
                    >
                      ${this.submitting ? 'Sending...' : 'Send Notification'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          `
        : ''}

      <!-- Notification Detail Modal -->
      ${this.selectedNotification
        ? html`
            <div class="modal-overlay" @click=${() => (this.selectedNotification = null)}>
              <div class="modal-dialog" style="max-width: 580px;" @click=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                  <h3>Notification Details</h3>
                  <button class="btn btn-outline btn-sm" @click=${() => (this.selectedNotification = null)}>
                    Close
                  </button>
                </div>

                <div class="modal-body">
                  <div class="detail-row">
                    <span class="detail-label">Title</span>
                    <span class="detail-val" style="font-weight: 700;">${this.selectedNotification.title}</span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Source &amp; Category</span>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      <span class="${this.selectedNotification.source === 'manual' ? 'badge-source-manual' : 'badge-source-system'}">
                        ${this.selectedNotification.source === 'manual' ? 'Manual Notification' : 'System Notification'}
                      </span>
                      <span class="badge badge-status">
                        ${(this.selectedNotification.type || 'INFO').toUpperCase().replace('_', ' ')}
                      </span>
                      ${this.selectedNotification.priority
                        ? html`
                            <span class="badge badge-priority-${this.selectedNotification.priority}">
                              ${this.selectedNotification.priority.toUpperCase()}
                            </span>
                          `
                        : ''}
                    </div>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Message Content</span>
                    <div style="font-size: 0.875rem; color: var(--text-primary); line-height: 1.5; background: var(--surface-secondary); padding: 0.85rem; border-radius: 4px; border: 1px solid var(--border-subtle);">
                      ${this.selectedNotification.message}
                    </div>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Sender</span>
                    <span class="detail-val">
                      ${this.selectedNotification.senderName
                        ? `${this.selectedNotification.senderName} (${(this.selectedNotification.senderRole || '').replace('_', ' ').toUpperCase()})`
                        : 'System Automatic Engine'}
                    </span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Recipient Target</span>
                    <span class="detail-val">
                      ${this.selectedNotification.recipientRole
                        ? `Role: ${this.selectedNotification.recipientRole.replace('_', ' ').toUpperCase()}`
                        : this.selectedNotification.userId === 'all'
                        ? 'All Organization Users'
                        : `User ID: ${this.selectedNotification.userId}`}
                    </span>
                  </div>

                  ${this.selectedNotification.projectId
                    ? html`
                        <div class="detail-row">
                          <span class="detail-label">Linked Project</span>
                          <span class="detail-val">
                            ${this.projects.find((p) => p.id === this.selectedNotification?.projectId)?.name || this.selectedNotification.projectId}
                          </span>
                        </div>
                      `
                    : ''}

                  ${this.selectedNotification.taskId
                    ? html`
                        <div class="detail-row">
                          <span class="detail-label">Linked Task</span>
                          <span class="detail-val">
                            ${this.tasks.find((t) => t.id === this.selectedNotification?.taskId)?.title || this.selectedNotification.taskId}
                          </span>
                        </div>
                      `
                    : ''}

                  <div class="detail-row">
                    <span class="detail-label">Timestamp</span>
                    <span class="detail-val" style="font-family: 'Space Mono', monospace; font-size: 0.8125rem;">
                      ${this.selectedNotification.createdAt ? this.selectedNotification.createdAt.replace('T', ' ').slice(0, 19) : ''}
                    </span>
                  </div>
                </div>

                <div class="modal-footer">
                  <button class="btn btn-primary" @click=${() => (this.selectedNotification = null)}>
                    Done
                  </button>
                </div>
              </div>
            </div>
          `
        : ''}
    `;
  }
}
