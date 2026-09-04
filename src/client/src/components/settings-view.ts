import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import type { SystemSettings, User } from '../types.js';
import { updateSettings, resetSeedData } from '../api.js';

@customElement('settings-view')
export class SettingsView extends LitElement {
  @property({ type: Object }) settings: SystemSettings = {
    organizationName: 'Nexus Enterprise Solutions',
    allowSelfRegistration: false,
    defaultTheme: 'dark',
    sessionTimeoutHours: 24,
    mlRiskThresholds: { high: 65, medium: 35 },
    lastSeedReset: '',
  };
  @property({ type: Object }) currentUser: User | null = null;

  @state() private orgName = '';
  @state() private highThreshold = 65;
  @state() private mediumThreshold = 35;
  @state() private msg = '';
  @state() private error = '';
  @state() private saving = false;
  @state() private resetting = false;

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

      .settings-stack {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        max-width: 720px;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    if (this.settings) {
      this.orgName = this.settings.organizationName || 'Nexus Enterprise Solutions';
      this.highThreshold = this.settings.mlRiskThresholds?.high || 65;
      this.mediumThreshold = this.settings.mlRiskThresholds?.medium || 35;
    }
  }

  private isAdmin(): boolean {
    return this.currentUser?.role === 'org_admin';
  }

  private async handleSave(e: Event) {
    e.preventDefault();
    this.saving = true;
    this.msg = '';
    this.error = '';

    try {
      const updated = await updateSettings({
        organizationName: this.orgName.trim(),
        mlRiskThresholds: {
          high: Number(this.highThreshold),
          medium: Number(this.mediumThreshold),
        },
      });
      this.msg = 'System settings saved successfully.';
      this.dispatchEvent(
        new CustomEvent('settings-updated', {
          detail: { settings: updated },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to save settings.';
    } finally {
      this.saving = false;
    }
  }

  private async handleResetSeed() {
    if (
      !confirm(
        'Are you sure you want to reset all data back to the realistic demo seed state? Any modifications will be replaced.',
      )
    ) {
      return;
    }

    this.resetting = true;
    try {
      await resetSeedData();
      alert('Data successfully reset to initial demo state.');
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      this.resetting = false;
    }
  }

  render() {
    return html`
      <div class="header-actions">
        <div>
          <h1>Enterprise System Settings</h1>
          <p>Global organizational parameters, ML engine sensitivities, and storage diagnostics</p>
        </div>
      </div>

      <div class="settings-stack">
        ${this.msg ? html`<div class="alert alert-success">${this.msg}</div>` : ''}
        ${this.error ? html`<div class="alert alert-danger">${this.error}</div>` : ''}

        <!-- Organization Identity -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Organization Profile</span>
          </div>

          <form @submit=${this.handleSave}>
            <div class="form-group">
              <label class="form-label">Enterprise Organization Name</label>
              <input
                type="text"
                class="form-input"
                .value=${this.orgName}
                @input=${(e: Event) => (this.orgName = (e.target as HTMLInputElement).value)}
                ?disabled=${!this.isAdmin()}
                required
              />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">ML High Risk Threshold (0-100)</label>
                <input
                  type="number"
                  class="form-input"
                  min="50"
                  max="95"
                  .value=${String(this.highThreshold)}
                  @input=${(e: Event) => (this.highThreshold = Number((e.target as HTMLInputElement).value))}
                  ?disabled=${!this.isAdmin()}
                />
              </div>

              <div class="form-group">
                <label class="form-label">ML Medium Risk Threshold (0-100)</label>
                <input
                  type="number"
                  class="form-input"
                  min="20"
                  max="60"
                  .value=${String(this.mediumThreshold)}
                  @input=${(e: Event) => (this.mediumThreshold = Number((e.target as HTMLInputElement).value))}
                  ?disabled=${!this.isAdmin()}
                />
              </div>
            </div>

            ${this.isAdmin()
              ? html`
                  <button
                    type="submit"
                    class="btn btn-primary"
                    ?disabled=${this.saving}
                  >
                    ${this.saving ? 'Saving...' : 'Save Configuration'}
                  </button>
                `
              : html`<p style="font-size: 0.75rem; color: var(--text-muted);">Super Admin privileges required to edit organizational settings.</p>`}
          </form>
        </div>

        <!-- Persistence & Data Architecture -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Storage & Architecture Diagnostic</span>
          </div>

          <div style="font-size: 0.8125rem; line-height: 1.6; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.5rem;">
            <div><strong>Persistence Architecture:</strong> 100% File-based local JSON data store (data/).</div>
            <div><strong>Atomic Write Strategy:</strong> Multi-process mutex with temporary file atomic rename sync.</div>
            <div><strong>Real-Time Sync Protocol:</strong> Server-Sent Events (/events) with broadcast emitter.</div>
            <div><strong>AI Integration Transport:</strong> Model Context Protocol (/mcp HTTP streamable endpoint).</div>
          </div>
        </div>

        <!-- Demo Seed Reset Panel -->
        <div class="card" style="border-color: var(--border-default);">
          <div class="card-header">
            <span class="card-title">Demo & Development Reset</span>
          </div>
          <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Re-populate all projects, users, tasks, audit history, timesheets, and teams to the default demo state.
          </p>
          <button
            type="button"
            class="btn btn-secondary"
            @click=${this.handleResetSeed}
            ?disabled=${this.resetting}
          >
            ${this.resetting ? 'Resetting Data...' : 'Reset All to Demo Seed Data'}
          </button>
        </div>
      </div>
    `;
  }
}
