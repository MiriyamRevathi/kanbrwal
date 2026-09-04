import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Task, User, Project } from '../types.js';

@customElement('kb-task')
export class TaskElement extends LitElement {
  @property({ type: Object }) task!: Task;
  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: Array }) projects: Project[] = [];

  static styles = [
    commonStyles,
    css`
      :host {
        display: block;
      }

      .task-card {
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        padding: 0.85rem;
        cursor: grab;
        transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .task-card:hover {
        border-color: var(--border-focus);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }

      .task-card:active {
        cursor: grabbing;
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }

      .proj-tag {
        font-family: 'Space Mono', monospace;
        font-size: 0.6875rem;
        font-weight: 700;
        color: var(--primary);
        background: var(--surface-secondary);
        padding: 0.1rem 0.35rem;
        border-radius: 3px;
        border: 1px solid var(--border-subtle);
      }

      .badges-row {
        display: flex;
        align-items: center;
        gap: 0.3rem;
      }

      .task-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
        line-height: 1.35;
        word-break: break-word;
      }

      .task-desc {
        font-size: 0.75rem;
        color: var(--text-secondary);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .tags-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .tag-pill {
        font-size: 0.625rem;
        padding: 0.1rem 0.35rem;
        background: var(--surface-secondary);
        color: var(--text-muted);
        border: 1px solid var(--border-subtle);
        border-radius: 3px;
      }

      .card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.6875rem;
        color: var(--text-muted);
        border-top: 1px solid var(--border-subtle);
        padding-top: 0.5rem;
        margin-top: 0.25rem;
      }

      .assignee-label {
        font-weight: 600;
        color: var(--text-primary);
      }

      .due-label {
        font-family: 'Space Mono', monospace;
      }

      .due-overdue {
        color: #ff6e78;
        font-weight: 700;
      }

      .card-controls {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.3rem;
        margin-top: 0.25rem;
      }
    `,
  ];

  private handleDragStart(e: DragEvent) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', this.task.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  private openDetail() {
    this.dispatchEvent(
      new CustomEvent('task-edit', {
        detail: { task: this.task },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const t = this.task;
    const proj = this.projects.find((p) => p.id === t.projectId);
    const isOverdue =
      t.dueDate &&
      t.column.toLowerCase() !== 'done' &&
      new Date(t.dueDate).getTime() < Date.now();

    return html`
      <div
        class="task-card"
        draggable="true"
        @dragstart=${this.handleDragStart}
        @click=${this.openDetail}
      >
        <div class="card-header">
          <span class="proj-tag">${proj?.key || 'TASK'}</span>
          <div class="badges-row">
            <span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span>
            ${t.riskLevel && t.riskLevel !== 'low'
              ? html`<span class="badge badge-risk-${t.riskLevel}">${t.riskLevel}</span>`
              : ''}
          </div>
        </div>

        <div class="task-title">${t.title}</div>
        ${t.description ? html`<div class="task-desc">${t.description}</div>` : ''}

        ${t.tags && t.tags.length > 0
          ? html`
              <div class="tags-list">
                ${t.tags.map((tag) => html`<span class="tag-pill">${tag}</span>`)}
              </div>
            `
          : ''}

        <div class="card-footer">
          <span class="assignee-label">${t.assignee || 'Unassigned'}</span>
          <span class="due-label ${isOverdue ? 'due-overdue' : ''}">
            ${t.dueDate ? t.dueDate.split('T')[0] : 'No Date'} ${isOverdue ? '(!)' : ''}
          </span>
        </div>

        <div class="card-controls" @click=${(e: Event) => e.stopPropagation()}>
          <button class="btn btn-outline btn-sm" @click=${this.openDetail}>
            Details
          </button>
        </div>
      </div>
    `;
  }
}
