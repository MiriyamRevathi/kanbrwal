import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { User, UserRole } from '../types.js';
import { createUser, updateUser, deleteUser } from '../api.js';

@customElement('users-view')
export class UsersView extends LitElement {
  @property({ type: Array }) users: User[] = [];
  @property({ type: Object }) currentUser: User | null = null;

  @state() private showModal = false;
  @state() private modalMode: 'create' | 'edit' = 'create';
  @state() private editingUserId = '';
  @state() private formName = '';
  @state() private formEmail = '';
  @state() private formPassword = '';
  @state() private formRole: UserRole = 'employee';
  @state() private formTitle = '';
  @state() private formStatus: 'active' | 'inactive' = 'active';
  @state() private formError = '';
  @state() private submitting = false;

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
    `,
  ];

  private canManageUsers(): boolean {
    const role = this.currentUser?.role;
    return role === 'org_admin';
  }

  private canDeleteUser(): boolean {
    return this.currentUser?.role === 'org_admin';
  }

  private openCreateModal() {
    this.modalMode = 'create';
    this.editingUserId = '';
    this.formName = '';
    this.formEmail = '';
    this.formPassword = '';
    this.formRole = 'employee';
    this.formTitle = 'Software Engineer';
    this.formStatus = 'active';
    this.formError = '';
    this.showModal = true;
  }

  private openEditModal(user: User) {
    this.modalMode = 'edit';
    this.editingUserId = user.id;
    this.formName = user.name;
    this.formEmail = user.email;
    this.formPassword = '';
    this.formRole = user.role;
    this.formTitle = user.title || '';
    this.formStatus = user.status || 'active';
    this.formError = '';
    this.showModal = true;
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.formName.trim() || !this.formEmail.trim()) {
      this.formError = 'Name and email are required.';
      return;
    }
    if (this.modalMode === 'create' && !this.formPassword) {
      this.formError = 'Password is required for new accounts.';
      return;
    }

    this.submitting = true;
    this.formError = '';

    try {
      if (this.modalMode === 'create') {
        const newUser = await createUser({
          name: this.formName.trim(),
          email: this.formEmail.trim().toLowerCase(),
          password: this.formPassword,
          role: this.formRole,
          title: this.formTitle.trim(),
        });
        this.dispatchEvent(
          new CustomEvent('user-created', {
            detail: { user: newUser },
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        const payload: Record<string, unknown> = {
          name: this.formName.trim(),
          email: this.formEmail.trim().toLowerCase(),
          role: this.formRole,
          title: this.formTitle.trim(),
          status: this.formStatus,
        };
        if (this.formPassword) {
          payload.password = this.formPassword;
        }
        const updated = await updateUser(this.editingUserId, payload);
        this.dispatchEvent(
          new CustomEvent('user-updated', {
            detail: { user: updated },
            bubbles: true,
            composed: true,
          }),
        );
      }
      this.showModal = false;
    } catch (err) {
      this.formError = err instanceof Error ? err.message : 'Action failed.';
    } finally {
      this.submitting = false;
    }
  }

  private async handleDelete(user: User) {
    if (user.id === this.currentUser?.id) {
      alert('Cannot delete your own user account.');
      return;
    }
    if (!confirm(`Delete user "${user.name}"?`)) return;

    try {
      await deleteUser(user.id);
      this.dispatchEvent(
        new CustomEvent('user-deleted', {
          detail: { userId: user.id },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user.');
    }
  }

  render() {
    return html`
      <div class="header-actions">
        <div>
          <h1>Enterprise Directory & Access Control</h1>
          <p>User identities, role-based authorization, and provisioning</p>
        </div>

        ${this.canManageUsers()
          ? html`
              <button class="btn btn-primary" @click=${this.openCreateModal}>
                + Add User
              </button>
            `
          : ''}
      </div>

      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Designation / Title</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.users.map(
                (u) => html`
                  <tr>
                    <td><strong>${u.name}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-role">${u.role}</span></td>
                    <td>${u.title || 'Team Member'}</td>
                    <td>
                      <span class="badge ${u.status === 'active' ? 'badge-risk-low' : 'badge-p0'}">
                        ${u.status || 'active'}
                      </span>
                    </td>
                    <td style="font-family: 'Space Mono', monospace; font-size: 0.75rem;">
                      ${u.createdAt ? u.createdAt.split('T')[0] : 'N/A'}
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.35rem;">
                        ${this.canManageUsers()
                          ? html`
                              <button class="btn btn-outline btn-sm" @click=${() => this.openEditModal(u)}>
                                Edit
                              </button>
                            `
                          : ''}
                        ${this.canDeleteUser() && u.id !== this.currentUser?.id
                          ? html`
                              <button class="btn btn-danger btn-sm" @click=${() => this.handleDelete(u)}>
                                Delete
                              </button>
                            `
                          : ''}
                      </div>
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add/Edit User Modal -->
      ${this.showModal
        ? html`
            <div class="modal-overlay" @click=${() => (this.showModal = false)}>
              <div class="modal-dialog" @click=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                  <h3>${this.modalMode === 'create' ? 'Add Enterprise User' : 'Edit User Profile'}</h3>
                  <button class="btn btn-outline btn-sm" @click=${() => (this.showModal = false)}>
                    Close
                  </button>
                </div>

                <form @submit=${this.handleSubmit}>
                  <div class="modal-body">
                    ${this.formError ? html`<div class="alert alert-danger">${this.formError}</div>` : ''}

                    <div class="form-group">
                      <label class="form-label">Full Name *</label>
                      <input
                        type="text"
                        class="form-input"
                        .value=${this.formName}
                        @input=${(e: Event) => (this.formName = (e.target as HTMLInputElement).value)}
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label">Email Address *</label>
                      <input
                        type="email"
                        class="form-input"
                        .value=${this.formEmail}
                        @input=${(e: Event) => (this.formEmail = (e.target as HTMLInputElement).value)}
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label">
                        ${this.modalMode === 'create' ? 'Password *' : 'Change Password (optional)'}
                      </label>
                      <input
                        type="password"
                        class="form-input"
                        .value=${this.formPassword}
                        @input=${(e: Event) => (this.formPassword = (e.target as HTMLInputElement).value)}
                        placeholder="••••••••"
                        ?required=${this.modalMode === 'create'}
                      />
                    </div>

                    <div class="form-row">
                      <div class="form-group">
                        <label class="form-label">System Role</label>
                        <select
                          class="form-select"
                          .value=${this.formRole}
                          @change=${(e: Event) => (this.formRole = (e.target as HTMLSelectElement).value as UserRole)}
                        >
                          <option value="org_admin">Organization Admin</option>
                          <option value="project_manager">Project Manager</option>
                          <option value="team_lead">Team Lead</option>
                          <option value="employee">Employee</option>
                          <option value="viewer">Viewer (Read-Only)</option>
                        </select>
                      </div>

                      <div class="form-group">
                        <label class="form-label">Account Status</label>
                        <select
                          class="form-select"
                          .value=${this.formStatus}
                          @change=${(e: Event) =>
                            (this.formStatus = (e.target as HTMLSelectElement).value as 'active' | 'inactive')}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive / Suspended</option>
                        </select>
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label">Job Title / Designation</label>
                      <input
                        type="text"
                        class="form-input"
                        .value=${this.formTitle}
                        @input=${(e: Event) => (this.formTitle = (e.target as HTMLInputElement).value)}
                        placeholder="e.g. Lead Systems Architect"
                      />
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
                      ?disabled=${this.submitting}
                    >
                      ${this.submitting ? 'Saving...' : 'Save User'}
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
