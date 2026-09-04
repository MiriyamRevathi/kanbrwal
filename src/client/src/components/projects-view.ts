import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Project, User, Priority } from '../types.js';
import { createProject, updateProject, deleteProject } from '../api.js';

@customElement('projects-view')
export class ProjectsView extends LitElement {
  @property({ type: Array }) projects: Project[] = [];
  @property({ type: Array }) users: User[] = [];
  @property({ type: Object }) currentUser: User | null = null;

  @state() private searchQuery = '';
  @state() private statusFilter = 'all';
  @state() private riskFilter = 'all';

  // Modal State
  @state() private showModal = false;
  @state() private modalMode: 'create' | 'edit' = 'create';
  @state() private editingProjectId = '';
  @state() private formName = '';
  @state() private formKey = '';
  @state() private formDescription = '';
  @state() private formManagerId = '';
  @state() private formPriority: Priority = 'P1';
  @state() private formStartDate = '';
  @state() private formTargetDate = '';
  @state() private formBudgetHours = 100;
  @state() private formError = '';
  @state() private formSubmitting = false;

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

      .project-card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 1.25rem;
      }

      .project-card {
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: border-color 0.15s ease;
      }

      .project-card:hover {
        border-color: var(--border-focus);
      }

      .card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .project-key {
        font-family: 'Space Mono', monospace;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--primary);
        background: var(--surface-secondary);
        padding: 0.15rem 0.4rem;
        border-radius: 3px;
        border: 1px solid var(--border-subtle);
      }

      .project-name {
        font-size: 1.0625rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0.25rem 0 0.5rem;
      }

      .project-desc {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        line-height: 1.4;
        margin-bottom: 1rem;
        flex: 1;
      }

      .meta-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
        font-size: 0.75rem;
        padding: 0.75rem;
        background: var(--surface-secondary);
        border-radius: 4px;
        margin-bottom: 1rem;
      }

      .meta-item {
        display: flex;
        flex-direction: column;
      }

      .meta-title {
        color: var(--text-muted);
        font-size: 0.6875rem;
        text-transform: uppercase;
      }

      .meta-val {
        color: var(--text-primary);
        font-weight: 600;
      }

      .card-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        border-top: 1px solid var(--border-subtle);
        padding-top: 0.75rem;
      }

      .btn-group {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
    `,
  ];

  private canManageProjects(): boolean {
    const role = this.currentUser?.role;
    return role === 'org_admin' || role === 'project_manager';
  }

  private canDeleteProject(): boolean {
    const role = this.currentUser?.role;
    return role === 'org_admin';
  }

  private openCreateModal() {
    this.modalMode = 'create';
    this.editingProjectId = '';
    this.formName = '';
    this.formKey = '';
    this.formDescription = '';
    this.formManagerId = this.currentUser?.id || '';
    this.formPriority = 'P1';
    this.formStartDate = new Date().toISOString().split('T')[0];
    this.formTargetDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    this.formBudgetHours = 120;
    this.formError = '';
    this.showModal = true;
  }

  private openEditModal(project: Project) {
    this.modalMode = 'edit';
    this.editingProjectId = project.id;
    this.formName = project.name;
    this.formKey = project.key;
    this.formDescription = project.description || '';
    this.formManagerId = project.managerId || '';
    this.formPriority = project.priority || 'P1';
    this.formStartDate = project.startDate ? project.startDate.split('T')[0] : '';
    this.formTargetDate = project.targetDate ? project.targetDate.split('T')[0] : '';
    this.formBudgetHours = project.budgetHours || 100;
    this.formError = '';
    this.showModal = true;
  }

  private async handleFormSubmit(e: Event) {
    e.preventDefault();
    if (!this.formName.trim()) {
      this.formError = 'Project name is required.';
      return;
    }

    this.formSubmitting = true;
    this.formError = '';

    try {
      if (this.modalMode === 'create') {
        const newProj = await createProject({
          name: this.formName.trim(),
          key: this.formKey.trim().toUpperCase() || undefined,
          description: this.formDescription.trim(),
          managerId: this.formManagerId,
          priority: this.formPriority,
          startDate: this.formStartDate,
          targetDate: this.formTargetDate,
          budgetHours: Number(this.formBudgetHours),
        });
        this.dispatchEvent(
          new CustomEvent('project-created', {
            detail: { project: newProj },
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        const updated = await updateProject(this.editingProjectId, {
          name: this.formName.trim(),
          key: this.formKey.trim().toUpperCase(),
          description: this.formDescription.trim(),
          managerId: this.formManagerId,
          priority: this.formPriority,
          startDate: this.formStartDate,
          targetDate: this.formTargetDate,
          budgetHours: Number(this.formBudgetHours),
        });
        this.dispatchEvent(
          new CustomEvent('project-updated', {
            detail: { project: updated },
            bubbles: true,
            composed: true,
          }),
        );
      }
      this.showModal = false;
    } catch (err) {
      this.formError = err instanceof Error ? err.message : 'Action failed.';
    } finally {
      this.formSubmitting = false;
    }
  }

  private async handleDelete(projectId: string, projectName: string) {
    if (!confirm(`Are you sure you want to delete project "${projectName}" and its tasks?`)) {
      return;
    }
    try {
      await deleteProject(projectId);
      this.dispatchEvent(
        new CustomEvent('project-deleted', {
          detail: { projectId },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project.');
    }
  }

  private openProjectDetails(projectId: string) {
    this.dispatchEvent(
      new CustomEvent('project-detail-select', {
        detail: { projectId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    let filtered = this.projects;

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      );
    }

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === this.statusFilter);
    }

    if (this.riskFilter !== 'all') {
      filtered = filtered.filter((p) => p.riskLevel === this.riskFilter);
    }

    return html`
      <div class="header-actions">
        <div>
          <h1>Enterprise Projects</h1>
          <p>Portfolio management, risk posture, and resource allocation</p>
        </div>
        ${this.canManageProjects()
          ? html`
              <button class="btn btn-primary" @click=${this.openCreateModal}>
                Create Project
              </button>
            `
          : ''}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-item" style="flex: 1; min-width: 200px;">
          <span class="filter-label">Search:</span>
          <input
            type="text"
            class="form-input"
            style="padding: 0.35rem 0.65rem;"
            placeholder="Search projects..."
            .value=${this.searchQuery}
            @input=${(e: Event) => (this.searchQuery = (e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="filter-item">
          <span class="filter-label">Status:</span>
          <select
            class="form-select"
            style="padding: 0.35rem 0.65rem; width: auto;"
            .value=${this.statusFilter}
            @change=${(e: Event) => (this.statusFilter = (e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="planning">Planning</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div class="filter-item">
          <span class="filter-label">Risk Level:</span>
          <select
            class="form-select"
            style="padding: 0.35rem 0.65rem; width: auto;"
            .value=${this.riskFilter}
            @change=${(e: Event) => (this.riskFilter = (e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
      </div>

      <!-- Project Cards Grid -->
      <div class="project-card-grid">
        ${filtered.length === 0
          ? html`<div class="card" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">No matching projects found.</div>`
          : filtered.map(
              (p) => html`
                <div class="project-card">
                  <div>
                    <div class="card-top">
                      <span class="project-key">${p.key}</span>
                      <div style="display: flex; gap: 0.35rem;">
                        <span class="badge badge-${p.priority?.toLowerCase() || 'p1'}">
                          ${p.priority || 'P1'}
                        </span>
                        <span class="badge badge-risk-${p.riskLevel || 'low'}">
                          ${p.riskLevel || 'LOW'}
                        </span>
                      </div>
                    </div>

                    <div class="project-name">${p.name}</div>
                    <div class="project-desc">${p.description || 'No description provided.'}</div>

                    <div class="meta-grid">
                      <div class="meta-item">
                        <span class="meta-title">Manager</span>
                        <span class="meta-val">${p.managerName || 'Unassigned'}</span>
                      </div>
                      <div class="meta-item">
                        <span class="meta-title">Deadline</span>
                        <span class="meta-val" style="font-family: 'Space Mono', monospace;">
                          ${p.targetDate ? p.targetDate.split('T')[0] : 'N/A'}
                        </span>
                      </div>
                      <div class="meta-item">
                        <span class="meta-title">Budget</span>
                        <span class="meta-val">${p.budgetHours || 0} Hours</span>
                      </div>
                      <div class="meta-item">
                        <span class="meta-title">ML Risk Score</span>
                        <span class="meta-val">${p.riskScore || 0}/100</span>
                      </div>
                    </div>
                  </div>

                  <div class="card-actions">
                    <button class="btn btn-secondary btn-sm" @click=${() => this.openProjectDetails(p.id)}>
                      View Details
                    </button>

                    <div class="btn-group">
                      ${this.canManageProjects()
                        ? html`
                            <button class="btn btn-outline btn-sm" @click=${() => this.openEditModal(p)}>
                              Edit
                            </button>
                          `
                        : ''}
                      ${this.canDeleteProject()
                        ? html`
                            <button class="btn btn-danger btn-sm" @click=${() => this.handleDelete(p.id, p.name)}>
                              Delete
                            </button>
                          `
                        : ''}
                    </div>
                  </div>
                </div>
              `,
            )}
      </div>

      <!-- Create / Edit Project Modal -->
      ${this.showModal
        ? html`
            <div class="modal-overlay" @click=${() => (this.showModal = false)}>
              <div class="modal-dialog" @click=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                  <h3>${this.modalMode === 'create' ? 'Create New Project' : 'Edit Project'}</h3>
                  <button class="btn btn-outline btn-sm" @click=${() => (this.showModal = false)}>
                    Close
                  </button>
                </div>

                <form @submit=${this.handleFormSubmit}>
                  <div class="modal-body">
                    ${this.formError ? html`<div class="alert alert-danger">${this.formError}</div>` : ''}

                    <div class="form-group">
                      <label class="form-label">Project Name *</label>
                      <input
                        type="text"
                        class="form-input"
                        .value=${this.formName}
                        @input=${(e: Event) => (this.formName = (e.target as HTMLInputElement).value)}
                        placeholder="e.g. Enterprise Mobile Banking"
                        required
                      />
                    </div>

                    <div class="form-row">
                      <div class="form-group">
                        <label class="form-label">Key Prefix</label>
                        <input
                          type="text"
                          class="form-input"
                          maxlength="8"
                          .value=${this.formKey}
                          @input=${(e: Event) => (this.formKey = (e.target as HTMLInputElement).value)}
                          placeholder="e.g. MBANK"
                        />
                      </div>

                      <div class="form-group">
                        <label class="form-label">Priority</label>
                        <select
                          class="form-select"
                          .value=${this.formPriority}
                          @change=${(e: Event) => (this.formPriority = (e.target as HTMLSelectElement).value as Priority)}
                        >
                          <option value="P0">P0 - Critical</option>
                          <option value="P1">P1 - Normal</option>
                          <option value="P2">P2 - Low</option>
                        </select>
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label">Description</label>
                      <textarea
                        class="form-textarea"
                        .value=${this.formDescription}
                        @input=${(e: Event) => (this.formDescription = (e.target as HTMLTextAreaElement).value)}
                        placeholder="Project objectives, requirements, and scope..."
                      ></textarea>
                    </div>

                    <div class="form-row">
                      <div class="form-group">
                        <label class="form-label">Project Manager</label>
                        <select
                          class="form-select"
                          .value=${this.formManagerId}
                          @change=${(e: Event) => (this.formManagerId = (e.target as HTMLSelectElement).value)}
                        >
                          <option value="">Unassigned</option>
                          ${this.users.map(
                            (u) => html`<option value=${u.id}>${u.name} (${u.role})</option>`,
                          )}
                        </select>
                      </div>

                      <div class="form-group">
                        <label class="form-label">Budget Hours</label>
                        <input
                          type="number"
                          class="form-input"
                          min="1"
                          .value=${String(this.formBudgetHours)}
                          @input=${(e: Event) =>
                            (this.formBudgetHours = Number((e.target as HTMLInputElement).value))}
                        />
                      </div>
                    </div>

                    <div class="form-row">
                      <div class="form-group">
                        <label class="form-label">Start Date</label>
                        <input
                          type="date"
                          class="form-input"
                          .value=${this.formStartDate}
                          @input=${(e: Event) => (this.formStartDate = (e.target as HTMLInputElement).value)}
                        />
                      </div>

                      <div class="form-group">
                        <label class="form-label">Target Deadline</label>
                        <input
                          type="date"
                          class="form-input"
                          .value=${this.formTargetDate}
                          @input=${(e: Event) => (this.formTargetDate = (e.target as HTMLInputElement).value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div class="modal-footer">
                    <button
                      type="button"
                      class="btn btn-outline"
                      @click=${() => (this.showModal = false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="btn btn-primary"
                      ?disabled=${this.formSubmitting}
                    >
                      ${this.formSubmitting ? 'Saving...' : 'Save Project'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          `
        : ''}
    `;
  }
}
