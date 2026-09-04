import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { TimesheetEntry, Project, Task, User, Team } from '../types.js';
import { logTime } from '../api.js';

@customElement('time-tracking-view')
export class TimeTrackingView extends LitElement {
  @property({ type: Array }) timesheets: TimesheetEntry[] = [];
  @property({ type: Array }) projects: Project[] = [];
  @property({ type: Array }) tasks: Task[] = [];
  @property({ type: Array }) users: User[] = [];
  @property({ type: Array }) teams: Team[] = [];
  @property({ type: Object }) currentUser: User | null = null;

  @state() private timerRunning = false;
  @state() private timerSeconds = 0;
  @state() private timerProjectId = '';
  @state() private timerTaskId = '';
  @state() private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Manual Log Form State
  @state() private formProjectId = '';
  @state() private formTaskId = '';
  @state() private formDate = new Date().toISOString().split('T')[0];
  @state() private formHours = 1;
  @state() private formDescription = '';
  @state() private formError = '';
  @state() private submitting = false;

  // Filter State
  @state() private filterUser = 'all';
  @state() private filterProject = 'all';

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

      .tracking-grid {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: 1.5rem;
      }

      @media (max-width: 1024px) {
        .tracking-grid {
          grid-template-columns: 1fr;
        }
      }

      .timer-display {
        font-family: 'Space Mono', monospace;
        font-size: 2.25rem;
        font-weight: 700;
        color: var(--text-primary);
        text-align: center;
        padding: 1rem;
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        margin-bottom: 1rem;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    if (this.projects.length > 0 && !this.formProjectId) {
      this.formProjectId = this.projects[0].id;
      this.timerProjectId = this.projects[0].id;
    }
  }

  private toggleTimer() {
    if (this.timerRunning) {
      // Stop timer and convert to hours
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerRunning = false;
      const hours = Math.max(0.1, Number((this.timerSeconds / 3600).toFixed(2)));
      this.formHours = hours;
      this.formProjectId = this.timerProjectId || this.projects[0]?.id || '';
      this.formTaskId = this.timerTaskId || '';
      this.formDescription = `Logged via live timer session (${this.timerSeconds}s)`;
    } else {
      // Start timer
      this.timerRunning = true;
      this.timerSeconds = 0;
      this.timerInterval = setInterval(() => {
        this.timerSeconds += 1;
        this.requestUpdate();
      }, 1000);
    }
  }

  private formatTimer(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  private async handleManualLog(e: Event) {
    e.preventDefault();
    if (!this.formProjectId || !this.formHours) {
      this.formError = 'Project and hours are required.';
      return;
    }

    this.submitting = true;
    this.formError = '';

    try {
      const entry = await logTime({
        projectId: this.formProjectId,
        taskId: this.formTaskId || undefined,
        date: this.formDate,
        hours: Number(this.formHours),
        description: this.formDescription.trim() || 'Work session',
      });

      this.dispatchEvent(
        new CustomEvent('timesheet-logged', {
          detail: { timesheet: entry },
          bubbles: true,
          composed: true,
        }),
      );

      this.formDescription = '';
      this.formHours = 1;
    } catch (err) {
      this.formError = err instanceof Error ? err.message : 'Failed to record time.';
    } finally {
      this.submitting = false;
    }
  }

  render() {
    const isLead = this.currentUser?.role === 'team_lead';
    const myTeam = isLead
      ? this.teams.find(
          (t) =>
            t.leadId === this.currentUser?.id ||
            (t.memberIds || []).includes(this.currentUser?.id || ''),
        )
      : undefined;
    const teamMemberIds: string[] = myTeam ? myTeam.memberIds || [] : [];

    // For team leads: only show team member timesheets; for others: show all
    let baseTimesheets = isLead && teamMemberIds.length > 0
      ? this.timesheets.filter((t) => teamMemberIds.includes(t.userId))
      : this.timesheets;

    // Scope visible users for filter dropdown
    const visibleUsers = isLead && teamMemberIds.length > 0
      ? this.users.filter((u) => teamMemberIds.includes(u.id))
      : this.users;

    let list = baseTimesheets;
    if (this.filterUser !== 'all') {
      list = list.filter((t) => t.userId === this.filterUser);
    }
    if (this.filterProject !== 'all') {
      list = list.filter((t) => t.projectId === this.filterProject);
    }

    const totalHours = list.reduce((sum, t) => sum + t.hours, 0);

    const projectTasks = this.tasks.filter((t) => t.projectId === this.formProjectId);

    return html`
      <div class="header-actions">
        <div>
          <h1>Time Tracking & Timesheets</h1>
          <p>Effort accounting, punch-clock sessions, and project labor metrics</p>
        </div>

        <div class="badge badge-status" style="font-size: 0.8125rem; padding: 0.4rem 0.8rem;">
          Total Displayed: <strong>${totalHours.toFixed(1)}h</strong>
        </div>
      </div>

      <div class="tracking-grid">
        <!-- Live Clock & Form -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Live Work Timer -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Live Work Timer</span>
              <span class="badge ${this.timerRunning ? 'badge-risk-low' : 'badge-status'}">
                ${this.timerRunning ? 'RECORDING' : 'IDLE'}
              </span>
            </div>

            <div class="timer-display">${this.formatTimer(this.timerSeconds)}</div>

            <div class="form-group">
              <label class="form-label">Active Project</label>
              <select
                class="form-select"
                .value=${this.timerProjectId}
                @change=${(e: Event) => (this.timerProjectId = (e.target as HTMLSelectElement).value)}
                ?disabled=${this.timerRunning}
              >
                ${this.projects.map((p) => html`<option value=${p.id}>[${p.key}] ${p.name}</option>`)}
              </select>
            </div>

            <button
              class="btn ${this.timerRunning ? 'btn-danger' : 'btn-primary'} btn-lg"
              style="width: 100%;"
              @click=${this.toggleTimer}
            >
              ${this.timerRunning ? 'Stop Timer & Populate Log' : 'Start Work Timer'}
            </button>
          </div>

          <!-- Manual Log Form -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Manual Time Entry</span>
            </div>

            <form @submit=${this.handleManualLog}>
              ${this.formError ? html`<div class="alert alert-danger">${this.formError}</div>` : ''}

              <div class="form-group">
                <label class="form-label">Project *</label>
                <select
                  class="form-select"
                  .value=${this.formProjectId}
                  @change=${(e: Event) => (this.formProjectId = (e.target as HTMLSelectElement).value)}
                  required
                >
                  ${this.projects.map((p) => html`<option value=${p.id}>[${p.key}] ${p.name}</option>`)}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Linked Task (optional)</label>
                <select
                  class="form-select"
                  .value=${this.formTaskId}
                  @change=${(e: Event) => (this.formTaskId = (e.target as HTMLSelectElement).value)}
                >
                  <option value="">General Project Work</option>
                  ${projectTasks.map((t) => html`<option value=${t.id}>${t.title}</option>`)}
                </select>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Date *</label>
                  <input
                    type="date"
                    class="form-input"
                    .value=${this.formDate}
                    @input=${(e: Event) => (this.formDate = (e.target as HTMLInputElement).value)}
                    required
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Hours Logged *</label>
                  <input
                    type="number"
                    class="form-input"
                    step="0.25"
                    min="0.25"
                    max="24"
                    .value=${String(this.formHours)}
                    @input=${(e: Event) => (this.formHours = Number((e.target as HTMLInputElement).value))}
                    required
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Work Description</label>
                <textarea
                  class="form-textarea"
                  .value=${this.formDescription}
                  @input=${(e: Event) => (this.formDescription = (e.target as HTMLTextAreaElement).value)}
                  placeholder="Summary of work completed during this window..."
                  style="min-height: 60px;"
                ></textarea>
              </div>

              <button
                type="submit"
                class="btn btn-primary"
                style="width: 100%;"
                ?disabled=${this.submitting}
              >
                ${this.submitting ? 'Recording...' : 'Record Labor Hours'}
              </button>
            </form>
          </div>
        </div>

        <!-- Timesheet History Table -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Timesheet History</span>
          </div>

          <div class="filter-bar" style="margin-bottom: 1rem;">
            <div class="filter-item">
              <span class="filter-label">Member:</span>
              <select
                class="form-select"
                style="padding: 0.35rem 0.65rem; width: auto;"
                .value=${this.filterUser}
                @change=${(e: Event) => (this.filterUser = (e.target as HTMLSelectElement).value)}
              >
                <option value="all">All Members</option>
                ${visibleUsers.map((u) => html`<option value=${u.id}>${u.name}</option>`)}
              </select>
            </div>

            <div class="filter-item">
              <span class="filter-label">Project:</span>
              <select
                class="form-select"
                style="padding: 0.35rem 0.65rem; width: auto;"
                .value=${this.filterProject}
                @change=${(e: Event) => (this.filterProject = (e.target as HTMLSelectElement).value)}
              >
                <option value="all">All Projects</option>
                ${this.projects.map((p) => html`<option value=${p.id}>[${p.key}] ${p.name}</option>`)}
              </select>
            </div>
          </div>

          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Member</th>
                  <th>Project</th>
                  <th>Task / Activity</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${list.length === 0
                  ? html`<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No timesheet entries found.</td></tr>`
                  : list.map(
                      (ts) => html`
                        <tr>
                          <td style="font-family: 'Space Mono', monospace; font-size: 0.75rem;">
                            ${ts.date}
                          </td>
                          <td><strong>${ts.userName}</strong></td>
                          <td>${ts.projectName}</td>
                          <td>
                            ${ts.taskTitle ? html`<div><strong>${ts.taskTitle}</strong></div>` : ''}
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">${ts.description}</div>
                          </td>
                          <td style="font-family: 'Space Mono', monospace; font-weight: 700;">
                            ${ts.hours}h
                          </td>
                          <td>
                            <span class="badge ${ts.status === 'approved' ? 'badge-risk-low' : 'badge-p1'}">
                              ${ts.status}
                            </span>
                          </td>
                        </tr>
                      `,
                    )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}
