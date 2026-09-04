import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Task, User, Project, Column, Priority, RiskLevel } from '../types.js';
import { createTask, updateTask, deleteTask } from '../api.js';

@customElement('task-modal')
export class TaskModal extends LitElement {
  @property({ type: Object }) task: Task | null = null;
  @property({ type: Array }) projects: Project[] = [];
  @property({ type: Array }) columns: Column[] = [];
  @property({ type: Array }) users: User[] = [];
  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: String }) defaultColumn = 'Backlog';
  @property({ type: String }) defaultProjectId = '';

  @state() private title = '';
  @state() private description = '';
  @state() private projectId = '';
  @state() private column = '';
  @state() private priority: Priority = 'P1';
  @state() private assigneeId = '';
  @state() private dueDate = '';
  @state() private estimatedHours = 8;
  @state() private actualHours = 0;
  @state() private tagsInput = '';
  @state() private riskLevel: RiskLevel = 'low';
  @state() private riskNotes = '';
  @state() private error = '';
  @state() private submitting = false;

  static styles = [
    commonStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    if (this.task) {
      this.title = this.task.title;
      this.description = this.task.description || '';
      this.projectId = this.task.projectId || this.projects[0]?.id || '';
      this.column = this.task.column;
      this.priority = this.task.priority || 'P1';
      this.assigneeId = this.task.assigneeId || '';
      this.dueDate = this.task.dueDate ? this.task.dueDate.split('T')[0] : '';
      this.estimatedHours = this.task.estimatedHours || 8;
      this.actualHours = this.task.actualHours || 0;
      this.tagsInput = (this.task.tags || []).join(', ');
      this.riskLevel = this.task.riskLevel || 'low';
      this.riskNotes = this.task.riskNotes || '';
    } else {
      this.title = '';
      this.description = '';
      this.projectId = this.defaultProjectId || this.projects[0]?.id || '';
      this.column = this.defaultColumn || this.columns[0]?.name || 'Backlog';
      this.priority = 'P1';
      this.assigneeId = this.currentUser?.id || '';
      this.dueDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      this.estimatedHours = 8;
      this.actualHours = 0;
      this.tagsInput = '';
      this.riskLevel = 'low';
      this.riskNotes = '';
    }
  }

  private canEditAdministrativeFields(): boolean {
    const role = this.currentUser?.role;
    if (role === 'viewer') return false;
    if (role === 'employee') return false;
    return true;
  }

  private canDelete(): boolean {
    const role = this.currentUser?.role;
    return role === 'org_admin' || role === 'project_manager' || role === 'team_lead';
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.title.trim()) {
      this.error = 'Task title is required.';
      return;
    }

    this.submitting = true;
    this.error = '';

    const tags = this.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      if (this.task) {
        const updated = await updateTask(this.task.id, {
          title: this.title.trim(),
          description: this.description.trim(),
          projectId: this.projectId,
          column: this.column,
          priority: this.priority,
          assigneeId: this.assigneeId,
          dueDate: this.dueDate,
          estimatedHours: Number(this.estimatedHours),
          actualHours: Number(this.actualHours),
          tags,
          riskLevel: this.riskLevel,
          riskNotes: this.riskNotes.trim(),
        });
        this.dispatchEvent(
          new CustomEvent('task-saved', {
            detail: { task: updated },
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        const created = await createTask({
          title: this.title.trim(),
          description: this.description.trim(),
          projectId: this.projectId,
          column: this.column,
          priority: this.priority,
          assigneeId: this.assigneeId,
          dueDate: this.dueDate,
          estimatedHours: Number(this.estimatedHours),
          actualHours: Number(this.actualHours),
          tags,
          riskLevel: this.riskLevel,
          riskNotes: this.riskNotes.trim(),
        });
        this.dispatchEvent(
          new CustomEvent('task-saved', {
            detail: { task: created },
            bubbles: true,
            composed: true,
          }),
        );
      }
      this.closeModal();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to save task.';
    } finally {
      this.submitting = false;
    }
  }

  private async handleDelete() {
    if (!this.task) return;
    if (!confirm(`Permanently delete task "${this.task.title}"?`)) return;

    try {
      await deleteTask(this.task.id);
      this.dispatchEvent(
        new CustomEvent('task-deleted', {
          detail: { taskId: this.task.id },
          bubbles: true,
          composed: true,
        }),
      );
      this.closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete task.');
    }
  }

  private closeModal() {
    this.dispatchEvent(
      new CustomEvent('modal-close', {
        bubbles: true,
        composed: true,
      }),
    );
    this.dispatchEvent(
      new CustomEvent('close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const isEdit = Boolean(this.task);
    const isViewer = this.currentUser?.role === 'viewer';

    return html`
      <div class="modal-overlay" @click=${this.closeModal}>
        <div class="modal-dialog" style="max-width: 720px;" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>${isEdit ? 'Task Details & Progress' : 'Create Enterprise Task'}</h3>
            <button class="btn btn-outline btn-sm" @click=${this.closeModal}>
              Close
            </button>
          </div>

          <form @submit=${this.handleSubmit}>
            <div class="modal-body">
              ${this.error ? html`<div class="alert alert-danger">${this.error}</div>` : ''}

              <div class="form-group">
                <label class="form-label">Task Title *</label>
                <input
                  type="text"
                  class="form-input"
                  .value=${this.title}
                  @input=${(e: Event) => (this.title = (e.target as HTMLInputElement).value)}
                  placeholder="Summary of task or deliverable..."
                  ?disabled=${isViewer}
                  required
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Project</label>
                  <select
                    class="form-select"
                    .value=${this.projectId}
                    @change=${(e: Event) => (this.projectId = (e.target as HTMLSelectElement).value)}
                    ?disabled=${isViewer || !this.canEditAdministrativeFields()}
                  >
                    ${this.projects.map(
                      (p) => html`<option value=${p.id}>[${p.key}] ${p.name}</option>`,
                    )}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Kanban Column Status</label>
                  <select
                    class="form-select"
                    .value=${this.column}
                    @change=${(e: Event) => (this.column = (e.target as HTMLSelectElement).value)}
                    ?disabled=${isViewer}
                  >
                    ${this.columns.map(
                      (c) => html`<option value=${c.name}>${c.name}</option>`,
                    )}
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Priority</label>
                  <select
                    class="form-select"
                    .value=${this.priority}
                    @change=${(e: Event) => (this.priority = (e.target as HTMLSelectElement).value as Priority)}
                    ?disabled=${isViewer || !this.canEditAdministrativeFields()}
                  >
                    <option value="P0">P0 - Critical Priority</option>
                    <option value="P1">P1 - Normal Priority</option>
                    <option value="P2">P2 - Low Priority</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Assignee</label>
                  <select
                    class="form-select"
                    .value=${this.assigneeId}
                    @change=${(e: Event) => (this.assigneeId = (e.target as HTMLSelectElement).value)}
                    ?disabled=${isViewer || !this.canEditAdministrativeFields()}
                  >
                    <option value="">Unassigned</option>
                    ${this.users.map(
                      (u) => html`<option value=${u.id}>${u.name} (${u.role})</option>`,
                    )}
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Detailed Description</label>
                <textarea
                  class="form-textarea"
                  .value=${this.description}
                  @input=${(e: Event) => (this.description = (e.target as HTMLTextAreaElement).value)}
                  placeholder="Requirements, architectural notes, testing criteria..."
                  ?disabled=${isViewer}
                ></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Due Date</label>
                  <input
                    type="date"
                    class="form-input"
                    .value=${this.dueDate}
                    @input=${(e: Event) => (this.dueDate = (e.target as HTMLInputElement).value)}
                    ?disabled=${isViewer || !this.canEditAdministrativeFields()}
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Estimated Hours</label>
                  <input
                    type="number"
                    class="form-input"
                    min="0"
                    .value=${String(this.estimatedHours)}
                    @input=${(e: Event) => (this.estimatedHours = Number((e.target as HTMLInputElement).value))}
                    ?disabled=${isViewer || !this.canEditAdministrativeFields()}
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Actual Hours Logged</label>
                  <input
                    type="number"
                    class="form-input"
                    min="0"
                    .value=${String(this.actualHours)}
                    @input=${(e: Event) => (this.actualHours = Number((e.target as HTMLInputElement).value))}
                    ?disabled=${isViewer}
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Risk Level</label>
                  <select
                    class="form-select"
                    .value=${this.riskLevel}
                    @change=${(e: Event) => (this.riskLevel = (e.target as HTMLSelectElement).value as RiskLevel)}
                    ?disabled=${isViewer}
                  >
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Tags (comma-separated)</label>
                  <input
                    type="text"
                    class="form-input"
                    .value=${this.tagsInput}
                    @input=${(e: Event) => (this.tagsInput = (e.target as HTMLInputElement).value)}
                    placeholder="e.g. Backend, Security, API"
                    ?disabled=${isViewer}
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Risk Notes / Blockers</label>
                <input
                  type="text"
                  class="form-input"
                  .value=${this.riskNotes}
                  @input=${(e: Event) => (this.riskNotes = (e.target as HTMLInputElement).value)}
                  placeholder="Explain blockers or dependency risks..."
                  ?disabled=${isViewer}
                />
              </div>
            </div>

            <div class="modal-footer">
              ${isEdit && this.canDelete()
                ? html`
                    <button
                      type="button"
                      class="btn btn-danger"
                      style="margin-right: auto;"
                      @click=${this.handleDelete}
                    >
                      Delete Task
                    </button>
                  `
                : ''}

              <button
                type="button"
                class="btn btn-outline"
                @click=${this.closeModal}
              >
                ${isViewer ? 'Close' : 'Cancel'}
              </button>

              ${!isViewer
                ? html`
                    <button
                      type="submit"
                      class="btn btn-primary"
                      ?disabled=${this.submitting}
                    >
                      ${this.submitting ? 'Saving...' : 'Save Task'}
                    </button>
                  `
                : ''}
            </div>
          </form>
        </div>
      </div>
    `;
  }
}
