import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Column, Task, User, Project } from '../types.js';
import './task.js';

@customElement('kb-column')
export class ColumnElement extends LitElement {
  @property({ type: Object }) column!: Column;
  @property({ type: Array }) tasks: Task[] = [];
  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: Array }) projects: Project[] = [];

  @state() private isDragOver = false;

  static styles = [
    commonStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        width: 300px;
        min-width: 300px;
        max-width: 300px;
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        height: 100%;
        overflow: hidden;
      }

      :host(.drag-over) {
        border-color: var(--primary);
        background: var(--surface-hover);
      }

      .column-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.85rem 1rem;
        background: var(--surface-primary);
        border-bottom: 1px solid var(--border-subtle);
        user-select: none;
      }

      .column-title-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .column-name {
        font-size: 0.875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-primary);
      }

      .task-count {
        font-family: 'Space Mono', monospace;
        font-size: 0.6875rem;
        font-weight: 700;
        background: var(--surface-secondary);
        color: var(--text-secondary);
        padding: 0.15rem 0.45rem;
        border-radius: 10px;
        border: 1px solid var(--border-subtle);
      }

      .task-list {
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        flex: 1;
        overflow-y: auto;
        min-height: 100px;
      }

      .empty-column {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100px;
        color: var(--text-muted);
        font-size: 0.75rem;
        border: 1px dashed var(--border-subtle);
        border-radius: 4px;
        text-align: center;
      }
    `,
  ];

  private canCreateTasks(): boolean {
    const role = this.currentUser?.role;
    return role !== 'viewer';
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    this.classList.add('drag-over');
  }

  private handleDragLeave() {
    this.classList.remove('drag-over');
  }

  private handleDrop(e: DragEvent) {
    e.preventDefault();
    this.classList.remove('drag-over');
    if (!e.dataTransfer) return;
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      this.dispatchEvent(
        new CustomEvent('task-moved', {
          detail: { taskId, targetColumn: this.column.name },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private handleAddTask() {
    this.dispatchEvent(
      new CustomEvent('task-create-column', {
        detail: { column: this.column.name },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const sortedTasks = [...this.tasks];

    // Column sorting
    if (this.column.sortBy === 'priority') {
      sortedTasks.sort((a, b) => a.priority.localeCompare(b.priority));
    } else if (this.column.sortBy === 'updated') {
      sortedTasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (this.column.sortBy === 'dueDate') {
      sortedTasks.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    }

    if (this.column.sortOrder === 'desc') {
      sortedTasks.reverse();
    }

    return html`
      <div class="column-header">
        <div class="column-title-group">
          <span class="column-name">${this.column.name}</span>
          <span class="task-count">${this.tasks.length}</span>
        </div>

        ${this.canCreateTasks()
          ? html`
              <button class="btn btn-outline btn-sm" @click=${this.handleAddTask}>
                + Add
              </button>
            `
          : ''}
      </div>

      <div
        class="task-list"
        @dragover=${this.handleDragOver}
        @dragleave=${this.handleDragLeave}
        @drop=${this.handleDrop}
      >
        ${sortedTasks.length === 0
          ? html`<div class="empty-column">Drag tasks here</div>`
          : sortedTasks.map(
              (task) => html`
                <kb-task
                  .task=${task}
                  .currentUser=${this.currentUser}
                  .projects=${this.projects}
                ></kb-task>
              `,
            )}
      </div>
    `;
  }
}
