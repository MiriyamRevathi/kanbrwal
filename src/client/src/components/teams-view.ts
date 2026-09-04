import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { Team, User, Task } from '../types.js';
import { createTeam, updateTeam } from '../api.js';

@customElement('teams-view')
export class TeamsView extends LitElement {
  @property({ type: Array }) teams: Team[] = [];
  @property({ type: Array }) users: User[] = [];
  @property({ type: Array }) tasks: Task[] = [];
  @property({ type: Object }) currentUser: User | null = null;

  @state() private showModal = false;
  @state() private formName = '';
  @state() private formLeadId = '';
  @state() private formDescription = '';
  @state() private formError = '';
  @state() private submitting = false;

  // Add Member Modal state
  @state() private showAddMemberModal = false;
  @state() private addMemberTeamId = '';
  @state() private addMemberUserId = '';
  @state() private addMemberError = '';
  @state() private addMemberSubmitting = false;

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

      .teams-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1.25rem;
      }

      .team-card {
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .team-name {
        font-size: 1.0625rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.35rem;
      }

      .team-desc {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        line-height: 1.4;
        margin-bottom: 1rem;
      }

      .member-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-top: 0.5rem;
      }

      .member-badge {
        font-size: 0.6875rem;
        padding: 0.15rem 0.45rem;
        background: var(--surface-secondary);
        color: var(--text-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 3px;
      }

      .team-actions {
        margin-top: 1rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--border-subtle);
      }
    `,
  ];

  private canCreateTeams(): boolean {
    const role = this.currentUser?.role;
    return role === 'org_admin';
  }

  private canAddMembers(team: Team): boolean {
    const role = this.currentUser?.role;
    if (role === 'org_admin' || role === 'project_manager') {
      return true;
    }
    if (role === 'team_lead' && team.leadId === this.currentUser?.id) {
      return true;
    }
    return false;
  }

  private openCreateModal() {
    this.formName = '';
    this.formLeadId = this.currentUser?.id || '';
    this.formDescription = '';
    this.formError = '';
    this.showModal = true;
  }

  private openAddMemberModal(teamId: string) {
    this.addMemberTeamId = teamId;
    this.addMemberUserId = '';
    this.addMemberError = '';
    this.showAddMemberModal = true;
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.formName.trim()) {
      this.formError = 'Team name is required.';
      return;
    }

    this.submitting = true;
    this.formError = '';

    try {
      const created = await createTeam({
        name: this.formName.trim(),
        leadId: this.formLeadId,
        description: this.formDescription.trim(),
        memberIds: [this.formLeadId],
      });
      this.dispatchEvent(
        new CustomEvent('team-created', {
          detail: { team: created },
          bubbles: true,
          composed: true,
        }),
      );
      this.showModal = false;
    } catch (err) {
      this.formError = err instanceof Error ? err.message : 'Failed to create team.';
    } finally {
      this.submitting = false;
    }
  }

  private async handleAddMember(e: Event) {
    e.preventDefault();
    if (!this.addMemberUserId) {
      this.addMemberError = 'Please select a user to add.';
      return;
    }

    this.addMemberSubmitting = true;
    this.addMemberError = '';

    try {
      const team = this.teams.find((t) => t.id === this.addMemberTeamId);
      if (!team) {
        this.addMemberError = 'Team not found.';
        return;
      }

      const currentMembers = team.memberIds || [];
      if (currentMembers.includes(this.addMemberUserId)) {
        this.addMemberError = 'User is already a member of this team.';
        return;
      }

      const updatedMembers = [...currentMembers, this.addMemberUserId];
      await updateTeam(this.addMemberTeamId, { memberIds: updatedMembers });

      this.dispatchEvent(
        new CustomEvent('team-updated', {
          bubbles: true,
          composed: true,
        }),
      );
      this.showAddMemberModal = false;
    } catch (err) {
      this.addMemberError = err instanceof Error ? err.message : 'Failed to add member.';
    } finally {
      this.addMemberSubmitting = false;
    }
  }

  render() {
    const isLead = this.currentUser?.role === 'team_lead';

    // For team leads: show only their teams
    const visibleTeams = isLead
      ? this.teams.filter(
          (t) =>
            t.leadId === this.currentUser?.id ||
            (t.memberIds || []).includes(this.currentUser?.id || ''),
        )
      : this.teams;

    // Get non-member users for add member modal
    const currentTeam = this.teams.find((t) => t.id === this.addMemberTeamId);
    const currentTeamMembers = currentTeam ? currentTeam.memberIds || [] : [];
    const availableUsers = this.users.filter((u) => !currentTeamMembers.includes(u.id));

    return html`
      <div class="header-actions">
        <div>
          <h1>${isLead ? 'My Team & Workload' : 'Engineering Teams & Workload'}</h1>
          <p>${isLead ? 'Your team roster, deliverables, and member management' : 'Cross-functional squads, tech leads, and resource distribution'}</p>
        </div>

        ${this.canCreateTeams()
          ? html`
              <button class="btn btn-primary" @click=${this.openCreateModal}>
                + Create Team
              </button>
            `
          : ''}
      </div>

      <div class="teams-grid">
        ${visibleTeams.map((team) => {
          const members = this.users.filter((u) => (team.memberIds || []).includes(u.id));
          const lead = this.users.find((u) => u.id === team.leadId);
          const activeTasks = this.tasks.filter(
            (t) =>
              (team.memberIds || []).includes(t.assigneeId || '') &&
              t.column.toLowerCase() !== 'done',
          ).length;

          return html`
            <div class="team-card">
              <div>
                <div class="team-name">${team.name}</div>
                <div class="team-desc">${team.description || 'No description available.'}</div>

                <div style="font-size: 0.75rem; margin-bottom: 0.75rem;">
                  <span style="color: var(--text-muted); text-transform: uppercase; font-size: 0.6875rem;">
                    Team Lead:
                  </span>
                  <strong>${lead?.name || team.leadName || 'Unassigned'}</strong>
                </div>

                <div style="font-size: 0.75rem; margin-bottom: 0.75rem;">
                  <span style="color: var(--text-muted); text-transform: uppercase; font-size: 0.6875rem;">
                    Active Deliverables:
                  </span>
                  <span style="font-family: 'Space Mono', monospace; font-weight: 700;">
                    ${activeTasks} Tasks
                  </span>
                </div>

                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-size: 0.6875rem;">
                  Squad Roster (${members.length}):
                </div>
                <div class="member-tags">
                  ${members.map(
                    (m) => html`<span class="member-badge">${m.name} (${m.role})</span>`,
                  )}
                </div>
              </div>

              ${this.canAddMembers(team)
                ? html`
                    <div class="team-actions">
                      <button
                        class="btn btn-outline btn-sm"
                        @click=${() => this.openAddMemberModal(team.id)}
                      >
                        + Add Member
                      </button>
                    </div>
                  `
                : ''}
            </div>
          `;
        })}
      </div>

      <!-- Create Team Modal -->
      ${this.showModal
        ? html`
            <div class="modal-overlay" @click=${() => (this.showModal = false)}>
              <div class="modal-dialog" @click=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                  <h3>Create Engineering Team</h3>
                  <button class="btn btn-outline btn-sm" @click=${() => (this.showModal = false)}>
                    Close
                  </button>
                </div>

                <form @submit=${this.handleSubmit}>
                  <div class="modal-body">
                    ${this.formError ? html`<div class="alert alert-danger">${this.formError}</div>` : ''}

                    <div class="form-group">
                      <label class="form-label">Team Name *</label>
                      <input
                        type="text"
                        class="form-input"
                        .value=${this.formName}
                        @input=${(e: Event) => (this.formName = (e.target as HTMLInputElement).value)}
                        placeholder="e.g. Core Platform & Infrastructure"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label">Team Lead</label>
                      <select
                        class="form-select"
                        .value=${this.formLeadId}
                        @change=${(e: Event) => (this.formLeadId = (e.target as HTMLSelectElement).value)}
                      >
                        ${this.users.map(
                          (u) => html`<option value=${u.id}>${u.name} (${u.role})</option>`,
                        )}
                      </select>
                    </div>

                    <div class="form-group">
                      <label class="form-label">Team Description</label>
                      <textarea
                        class="form-textarea"
                        .value=${this.formDescription}
                        @input=${(e: Event) => (this.formDescription = (e.target as HTMLTextAreaElement).value)}
                        placeholder="Areas of ownership and domain responsibilities..."
                      ></textarea>
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
                      ${this.submitting ? 'Creating...' : 'Create Team'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          `
        : ''}

      <!-- Add Member Modal -->
      ${this.showAddMemberModal
        ? html`
            <div class="modal-overlay" @click=${() => (this.showAddMemberModal = false)}>
              <div class="modal-dialog" @click=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                  <h3>Add Member to ${currentTeam?.name || 'Team'}</h3>
                  <button class="btn btn-outline btn-sm" @click=${() => (this.showAddMemberModal = false)}>
                    Close
                  </button>
                </div>

                <form @submit=${this.handleAddMember}>
                  <div class="modal-body">
                    ${this.addMemberError ? html`<div class="alert alert-danger">${this.addMemberError}</div>` : ''}

                    <div class="form-group">
                      <label class="form-label">Select User to Add *</label>
                      <select
                        class="form-select"
                        .value=${this.addMemberUserId}
                        @change=${(e: Event) => (this.addMemberUserId = (e.target as HTMLSelectElement).value)}
                        required
                      >
                        <option value="">-- Select a user --</option>
                        ${availableUsers.map(
                          (u) => html`<option value=${u.id}>${u.name} (${u.role}) - ${u.email}</option>`,
                        )}
                      </select>
                    </div>

                    ${availableUsers.length === 0
                      ? html`<p style="font-size: 0.8125rem; color: var(--text-muted);">All users are already members of this team.</p>`
                      : ''}
                  </div>

                  <div class="modal-footer">
                    <button
                      type="button"
                      class="btn btn-outline"
                      @click=${() => (this.showAddMemberModal = false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="btn btn-primary"
                      ?disabled=${this.addMemberSubmitting || availableUsers.length === 0}
                    >
                      ${this.addMemberSubmitting ? 'Adding...' : 'Add to Team'}
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
