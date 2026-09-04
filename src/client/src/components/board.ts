import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Column, Task, User, Project, Priority } from '../types.js';
import { updateTask } from '../api.js';
import './column.js';
import './task-modal.js';

@customElement('kb-board')
export class BoardElement extends LitElement {
  @property({ type: Array }) columns: Column[] = [];
  @property({ type: Array }) tasks: Task[] = [];
  @property({ type: Array }) projects: Project[] = [];
  @property({ type: Array }) users: User[] = [];
  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: String }) selectedProjectId = 'all';

  @state() private searchQuery = '';
  @state() private priorityFilter = 'all';
  @state() private assigneeFilter = 'all';
  @state() private riskFilter = 'all';

  // Task Modal state
  @state() private selectedTask: Task | null = null;
  @state() private showTaskModal = false;
  @state() private modalDefaultColumn = 'Backlog';

  static styles = [
    commonStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        padding: 1.25rem 1.5rem 1.5rem;
      }

      .board-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }

      .board-columns-container {
        display: flex;
        gap: 1.25rem;
        flex: 1;
        overflow-x: auto;
        overflow-y: hidden;
        padding-bottom: 0.5rem;
      }
    `,
  ];

  private canCreateTask(): boolean {
    return this.currentUser?.role !== 'viewer';
  }

  private openNewTaskModal(columnName = 'Backlog') {
    this.selectedTask = null;
    this.modalDefaultColumn = columnName;
    this.showTaskModal = true;
  }

  private openEditTaskModal(task: Task) {
    this.selectedTask = task;
    this.showTaskModal = true;
  }

  private async handleTaskMoved(e: CustomEvent<{ taskId: string; targetColumn: string }>) {
    const { taskId, targetColumn } = e.detail;
    try {
      await updateTask(taskId, { column: targetColumn });
      this.dispatchEvent(
        new CustomEvent('board-refresh-request', {
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to move task.');
    }
  }

  render() {
    let filteredTasks = this.tasks;

    // Project filter
    if (this.selectedProjectId !== 'all') {
      filteredTasks = filteredTasks.filter((t) => t.projectId === this.selectedProjectId);
    }

    // Search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filteredTasks = filteredTasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    // Priority filter
    if (this.priorityFilter !== 'all') {
      filteredTasks = filteredTasks.filter((t) => t.priority === this.priorityFilter);
    }

    // Assignee filter
    if (this.assigneeFilter !== 'all') {
      filteredTasks = filteredTasks.filter((t) => t.assigneeId === this.assigneeFilter);
    }

    // Risk filter
    if (this.riskFilter !== 'all') {
      filteredTasks = filteredTasks.filter((t) => t.riskLevel === this.riskFilter);
    }

    return html`
      <div class="board-header">
        <div>
          <h2>Enterprise Kanban Board</h2>
          <p>Real-time collaborative task pipeline with instant SSE synchronization</p>
        </div>

        ${this.canCreateTask()
          ? html`
              <button class="btn btn-primary" @click=${() => this.openNewTaskModal('Backlog')}>
                + New Task
              </button>
            `
          : ''}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-item" style="flex: 1; min-width: 180px;">
          <span class="filter-label">Search:</span>
          <input
            type="text"
            class="form-input"
            style="padding: 0.35rem 0.65rem;"
            placeholder="Search tasks..."
            .value=${this.searchQuery}
            @input=${(e: Event) => (this.searchQuery = (e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="filter-item">
          <span class="filter-label">Priority:</span>
          <select
            class="form-select"
            style="padding: 0.35rem 0.65rem; width: auto;"
            .value=${this.priorityFilter}
            @change=${(e: Event) => (this.priorityFilter = (e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Priorities</option>
            <option value="P0">P0 - Critical</option>
            <option value="P1">P1 - Normal</option>
            <option value="P2">P2 - Low</option>
          </select>
        </div>

        <div class="filter-item">
          <span class="filter-label">Assignee:</span>
          <select
            class="form-select"
            style="padding: 0.35rem 0.65rem; width: auto;"
            .value=${this.assigneeFilter}
            @change=${(e: Event) => (this.assigneeFilter = (e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Assignees</option>
            ${this.users.map((u) => html`<option value=${u.id}>${u.name}</option>`)}
          </select>
        </div>

        <div class="filter-item">
          <span class="filter-label">Risk:</span>
          <select
            class="form-select"
            style="padding: 0.35rem 0.65rem; width: auto;"
            .value=${this.riskFilter}
            @change=${(e: Event) => (this.riskFilter = (e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Risks</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
      </div>

      <!-- Kanban Columns -->
      <div class="board-columns-container">
        ${this.columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.column === col.name);
          return html`
            <kb-column
              .column=${col}
              .tasks=${colTasks}
              .currentUser=${this.currentUser}
              .projects=${this.projects}
              @task-moved=${this.handleTaskMoved}
              @task-edit=${(e: CustomEvent<{ task: Task }>) => this.openEditTaskModal(e.detail.task)}
              @task-create-column=${(e: CustomEvent<{ column: string }>) =>
                this.openNewTaskModal(e.detail.column)}
            ></kb-column>
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
              .defaultColumn=${this.modalDefaultColumn}
              .defaultProjectId=${this.selectedProjectId !== 'all' ? this.selectedProjectId : ''}
              @modal-close=${() => (this.showTaskModal = false)}
              @task-saved=${() => {
                this.showTaskModal = false;
                this.dispatchEvent(
                  new CustomEvent('board-refresh-request', {
                    bubbles: true,
                    composed: true,
                  }),
                );
              }}
              @task-deleted=${() => {
                this.showTaskModal = false;
                this.dispatchEvent(
                  new CustomEvent('board-refresh-request', {
                    bubbles: true,
                    composed: true,
                  }),
                );
              }}
            ></task-modal>
          `
        : ''}
    `;
  }
}
