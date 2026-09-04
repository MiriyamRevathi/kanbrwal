import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { commonStyles } from '../styles.js';
import { login } from '../api.js';
import type { User } from '../types.js';

@customElement('login-view')
export class LoginView extends LitElement {
  @state() private email = '';
  @state() private password = '';
  @state() private error = '';
  @state() private loading = false;

  static styles = [
    commonStyles,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: var(--bg-base);
        padding: 2rem;
      }

      .login-container {
        width: 100%;
        max-width: 520px;
        background: var(--surface-primary);
        border: 1px solid var(--border-default);
        border-radius: 8px;
        padding: 2.25rem;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
      }

      .brand-header {
        margin-bottom: 1.5rem;
        text-align: center;
      }

      .brand-title {
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--text-primary);
      }

      .brand-subtitle {
        font-size: 0.8125rem;
        color: var(--text-muted);
        margin-top: 0.25rem;
      }

      .demo-section {
        margin-top: 1.75rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--border-subtle);
      }

      .demo-title {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        margin-bottom: 0.75rem;
      }

      .demo-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
      }

      @media (max-width: 480px) {
        .demo-grid {
          grid-template-columns: 1fr;
        }
      }

      .demo-btn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0.5rem 0.65rem;
        background: var(--surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
        text-align: left;
        transition: all 0.15s ease;
      }

      .demo-btn:hover {
        background: var(--surface-hover);
        border-color: var(--border-focus);
      }

      .demo-role {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .demo-desc {
        font-size: 0.6875rem;
        color: var(--text-muted);
        font-family: 'Space Mono', monospace;
      }
    `,
  ];

  private async handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.email || !this.password) {
      this.error = 'Please enter both email and password.';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const result = await login(this.email, this.password);
      this.dispatchEvent(
        new CustomEvent('login-success', {
          detail: { user: result.user },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Invalid credentials.';
    } finally {
      this.loading = false;
    }
  }

  private fillDemo(email: string, pass: string) {
    this.email = email;
    this.password = pass;
    this.error = '';
  }

  render() {
    return html`
      <div class="login-container">
        <div class="brand-header">
          <div class="brand-title">Kanbrawl Enterprise</div>
          <div class="brand-subtitle">Project Management & AI Agent Collaboration Platform</div>
        </div>

        ${this.error ? html`<div class="alert alert-danger">${this.error}</div>` : ''}

        <form @submit=${this.handleSubmit}>
          <div class="form-group">
            <label class="form-label">Email or Username</label>
            <input
              type="text"
              class="form-input"
              .value=${this.email}
              @input=${(e: Event) => (this.email = (e.target as HTMLInputElement).value)}
              placeholder="name@enterprise.com"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Password</label>
            <input
              type="password"
              class="form-input"
              .value=${this.password}
              @input=${(e: Event) => (this.password = (e.target as HTMLInputElement).value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-lg"
            style="width: 100%; margin-top: 0.5rem;"
            ?disabled=${this.loading}
          >
            ${this.loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div class="demo-section">
          <div class="demo-title">Quick Demo Sign In</div>
          <div class="demo-grid">
            <button
              class="demo-btn"
              type="button"
              @click=${() => this.fillDemo('orgadmin@enterprise.com', 'admin123')}
            >
              <span class="demo-role">Org Admin</span>
              <span class="demo-desc">orgadmin@enterprise.com</span>
            </button>

            <button
              class="demo-btn"
              type="button"
              @click=${() => this.fillDemo('pm@enterprise.com', 'pm123')}
            >
              <span class="demo-role">Project Manager</span>
              <span class="demo-desc">pm@enterprise.com</span>
            </button>

            <button
              class="demo-btn"
              type="button"
              @click=${() => this.fillDemo('lead@enterprise.com', 'lead123')}
            >
              <span class="demo-role">Team Lead</span>
              <span class="demo-desc">lead@enterprise.com</span>
            </button>

            <button
              class="demo-btn"
              type="button"
              @click=${() => this.fillDemo('employee@enterprise.com', 'emp123')}
            >
              <span class="demo-role">Employee (Dev)</span>
              <span class="demo-desc">employee@enterprise.com</span>
            </button>

            <button
              class="demo-btn"
              type="button"
              @click=${() => this.fillDemo('viewer@enterprise.com', 'view123')}
            >
              <span class="demo-role">Viewer (Read-Only)</span>
              <span class="demo-desc">viewer@enterprise.com</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
