import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Task, Project, User, Column } from '../types.js';
import './task-modal.js';

@customElement('calendar-view')
export class CalendarView extends LitElement {
  @property({ type: Array }) tasks: Task[] = [];
  @property({ type: Array }) projects: Project[] = [];
  @property({ type: Array }) columns: Column[] = [];
  @property({ type: Array }) users: User[] = [];
  @property({ type: Object }) currentUser: User | null = null;

  @state() private currentYear = new Date().getFullYear();
  @state() private currentMonth = new Date().getMonth(); // 0-indexed
  @state() private showTaskModal = false;
  @state() private selectedTask: Task | null = null;

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

      .header-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .month-nav {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .month-title {
        font-size: 1.125rem;
        font-weight: 700;
        min-width: 180px;
        text-align: center;
      }

      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        background: var(--border-subtle);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        overflow: hidden;
      }

      .day-header {
        background: var(--surface-secondary);
        color: var(--text-muted);
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 0.6rem;
        text-align: center;
      }

      .day-cell {
        background: var(--surface-primary);
        min-height: 110px;
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        transition: background 0.15s ease;
      }

      .day-cell.other-month {
        background: var(--surface-secondary);
        opacity: 0.5;
      }

      .day-cell.today {
        background: var(--surface-hover);
        border: 1px solid var(--primary);
      }

      .day-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .day-number {
        font-size: 0.75rem;
        font-weight: 700;
        font-family: 'Space Mono', monospace;
        color: var(--text-muted);
      }

      .cell-add-btn {
        font-size: 0.625rem;
        padding: 0.1rem 0.3rem;
        background: transparent;
        border: 1px solid var(--border-subtle);
        color: var(--text-muted);
        border-radius: 3px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s ease;
      }

      .day-cell:hover .cell-add-btn {
        opacity: 1;
      }

      .cell-add-btn:hover {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
      }

      .event-chip {
        font-size: 0.6875rem;
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }

      .event-chip:hover {
        border-color: var(--primary);
        background: var(--surface-hover);
      }
    `,
  ];

  private canAddTask(): boolean {
    const role = this.currentUser?.role;
    return (
      role === 'org_admin' ||
      role === 'project_manager' ||
      role === 'team_lead'
    );
  }

  private openAddTaskModal(defaultDateStr?: string) {
    this.selectedTask = null;
    if (defaultDateStr) {
      // create draft task shell with preset due date
      this.selectedTask = {
        id: '',
        title: '',
        description: '',
        projectId: this.projects[0]?.id || '',
        column: this.columns[0]?.name || 'Backlog',
        priority: 'P1',
        dueDate: defaultDateStr,
        estimatedHours: 8,
        actualHours: 0,
        tags: [],
        dependencies: [],
        riskLevel: 'low',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    this.showTaskModal = true;
  }

  private openTaskDetail(task: Task) {
    this.selectedTask = task;
    this.showTaskModal = true;
  }

  private prevMonth() {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear -= 1;
    } else {
      this.currentMonth -= 1;
    }
  }

  private nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear += 1;
    } else {
      this.currentMonth += 1;
    }
  }

  render() {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    const calendarDays = [];

    // Prev month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      calendarDays.push({
        dayNum,
        otherMonth: true,
        dateStr: `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendarDays.push({
        dayNum: d,
        otherMonth: false,
        dateStr,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to fill complete grid of 35 or 42
    const totalCells = calendarDays.length > 35 ? 42 : 35;
    const remaining = totalCells - calendarDays.length;
    for (let n = 1; n <= remaining; n++) {
      calendarDays.push({
        dayNum: n,
        otherMonth: true,
        dateStr: `${this.currentYear}-${String(this.currentMonth + 2).padStart(2, '0')}-${String(n).padStart(2, '0')}`,
      });
    }

    return html`
      <div class="header-actions">
        <div>
          <h1>Enterprise Project Calendar</h1>
          <p>Task delivery schedules, milestone deadlines, and sprint commitments</p>
        </div>

        <div class="header-controls">
          <div class="month-nav">
            <button class="btn btn-outline btn-sm" @click=${this.prevMonth}>
              Previous Month
            </button>
            <span class="month-title">
              ${monthNames[this.currentMonth]} ${this.currentYear}
            </span>
            <button class="btn btn-outline btn-sm" @click=${this.nextMonth}>
              Next Month
            </button>
          </div>

          ${this.canAddTask()
            ? html`
                <button
                  class="btn btn-primary"
                  @click=${() => this.openAddTaskModal()}
                >
                  + Add Task to Calendar
                </button>
              `
            : ''}
        </div>
      </div>

      <div class="calendar-grid">
        <div class="day-header">Sun</div>
        <div class="day-header">Mon</div>
        <div class="day-header">Tue</div>
        <div class="day-header">Wed</div>
        <div class="day-header">Thu</div>
        <div class="day-header">Fri</div>
        <div class="day-header">Sat</div>

        ${calendarDays.map((cell) => {
          const dayTasks = this.tasks.filter(
            (t) => t.dueDate && t.dueDate.startsWith(cell.dateStr),
          );
          const dayProjects = this.projects.filter(
            (p) => p.targetDate && p.targetDate.startsWith(cell.dateStr),
          );

          return html`
            <div class="day-cell ${cell.otherMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''}">
              <div class="day-top">
                <span class="day-number">${cell.dayNum}</span>
                ${this.canAddTask()
                  ? html`
                      <button
                        class="cell-add-btn"
                        title="Add task on ${cell.dateStr}"
                        @click=${() => this.openAddTaskModal(cell.dateStr)}
                      >
                        + Add Task
                      </button>
                    `
                  : ''}
              </div>

              ${dayProjects.map(
                (p) => html`
                  <div
                    class="event-chip"
                    style="border-left: 3px solid var(--primary); font-weight: 700;"
                    @click=${() =>
                      this.dispatchEvent(
                        new CustomEvent('project-detail-select', {
                          detail: { projectId: p.id },
                          bubbles: true,
                          composed: true,
                        }),
                      )}
                  >
                    [MILESTONE] ${p.key} Deadline
                  </div>
                `,
              )}

              ${dayTasks.map(
                (t) => html`
                  <div
                    class="event-chip"
                    @click=${() => this.openTaskDetail(t)}
                  >
                    <span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span>
                    <span>${t.title}</span>
                  </div>
                `,
              )}
            </div>
          `;
        })}
      </div>

      <!-- Task Modal -->
      ${this.showTaskModal
        ? html`
            <task-modal
              .task=${this.selectedTask}
              .projects=${this.projects}
              .columns=${this.columns}
              .users=${this.users}
              .currentUser=${this.currentUser}
              .defaultProjectId=${this.projects[0]?.id || ''}
              @modal-close=${() => (this.showTaskModal = false)}
              @close=${() => (this.showTaskModal = false)}
              @task-saved=${() => {
                this.showTaskModal = false;
                this.dispatchEvent(
                  new CustomEvent('task-created', { bubbles: true, composed: true }),
                );
                this.dispatchEvent(
                  new CustomEvent('task-updated', { bubbles: true, composed: true }),
                );
              }}
              @task-deleted=${() => {
                this.showTaskModal = false;
                this.dispatchEvent(
                  new CustomEvent('task-deleted', { bubbles: true, composed: true }),
                );
              }}
            ></task-modal>
          `
        : ''}
    `;
  }
}

// Interactive calendar verified

// Feature Enterprise Calendar

// Feature Enterprise Calendar
