import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  Board,
  User,
  Project,
  Task,
  ActiveView,
} from './types.js';
import {
  fetchBoard,
  fetchCurrentUser,
  logout,
} from './api.js';

import './components/nav-sidebar.js';
import './components/top-header.js';
import './components/login-view.js';
import './components/dashboard-view.js';
import './components/projects-view.js';
import './components/project-detail-view.js';
import './components/board.js';
import './components/users-view.js';
import './components/teams-view.js';
import './components/time-tracking-view.js';
import './components/calendar-view.js';
import './components/reports-view.js';
import './components/audit-view.js';
import './components/notifications-view.js';
import './components/settings-view.js';

@customElement('kanbrawl-app')
export class KanbrawlApp extends LitElement {
  @state() private currentUser: User | null = null;
  @state() private authChecked = false;
  @state() private board: Board = {
    columns: [],
    tasks: [],
    projects: [],
    users: [],
    teams: [],
    timesheets: [],
    activities: [],
    notifications: [],
    settings: {
      organizationName: 'Nexus Enterprise Solutions',
      allowSelfRegistration: false,
      defaultTheme: 'dark',
      sessionTimeoutHours: 24,
      mlRiskThresholds: { high: 65, medium: 35 },
      lastSeedReset: '',
    },
    theme: 'dark',
  };

  @state() private activeView: ActiveView = 'dashboard';
  @state() private selectedProjectId = 'all';
  @state() private selectedProjectDetailId = '';
  @state() private connected = false;
  @state() private theme: 'dark' | 'light' = 'dark';

  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--bg-base);
      color: var(--text-primary);
      overflow: hidden;

      /* ── Enterprise Dark Theme (Default) ── */
      --bg-base: #0f1117;
      --surface-primary: #171a23;
      --surface-secondary: #1e222e;
      --surface-hover: #262b3a;
      --input-bg: #12141c;
      --border-default: #313749;
      --border-subtle: #242938;
      --border-focus: #5b73e8;
      --text-primary: #f0f2f8;
      --text-secondary: #a3adc2;
      --text-muted: #6f7990;
      --primary: #4f6cf7;
      --primary-hover: #3e5be0;
      --danger-bg: #3d1419;
      --danger-border: #75232d;
      --danger-text: #ff7582;
      --danger-hover: #4d1a20;
    }

    :host([data-theme='light']) {
      /* ── Enterprise Light Theme ── */
      --bg-base: #f4f6f9;
      --surface-primary: #ffffff;
      --surface-secondary: #f0f2f6;
      --surface-hover: #e6e9f0;
      --input-bg: #ffffff;
      --border-default: #d1d6e2;
      --border-subtle: #e2e6ef;
      --border-focus: #4f6cf7;
      --text-primary: #151922;
      --text-secondary: #4a5468;
      --text-muted: #7c889e;
      --primary: #3b57e0;
      --primary-hover: #2d45c5;
      --danger-bg: #fde8ea;
      --danger-border: #f8b4bb;
      --danger-text: #d92538;
      --danger-hover: #fcd5d8;
    }

    .app-layout {
      display: flex;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .main-wrapper {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      overflow: hidden;
    }

    .content-area {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .loading-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-size: 0.875rem;
      color: var(--text-muted);
      font-family: 'Space Mono', monospace;
    }
  `;

  async connectedCallback() {
    super.connectedCallback();
    this.updateThemeAttribute();

    window.addEventListener('auth-unauthorized', () => {
      this.currentUser = null;
    });

    await this.initSession();
    this.connectSSE();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.eventSource) {
      this.eventSource.close();
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
  }

  private updateThemeAttribute() {
    this.setAttribute('data-theme', this.theme);
  }

  private async initSession() {
    try {
      const auth = await fetchCurrentUser();
      if (auth && auth.user) {
        this.currentUser = auth.user;
        await this.loadBoardData();
      }
    } catch {
      this.currentUser = null;
    } finally {
      this.authChecked = true;
    }
  }

  private async loadBoardData() {
    try {
      const data = await fetchBoard();
      this.board = data;
    } catch (err) {
      console.error('Failed to load board data:', err);
    }
  }

  private connectSSE() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource('/events');

    this.eventSource.onopen = () => {
      this.connected = true;
    };

    this.eventSource.onerror = () => {
      this.connected = false;
      this.eventSource?.close();
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.connectSSE();
      }, 3000);
    };

    this.eventSource.addEventListener('board_sync', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.board) {
          this.board = payload.board;
        }
      } catch (err) {
        console.error('SSE sync error:', err);
      }
    });

    this.eventSource.addEventListener('task_created', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      if (payload.task) {
        const exists = this.board.tasks.some((t) => t.id === payload.task.id);
        if (!exists) {
          this.board = {
            ...this.board,
            tasks: [...this.board.tasks, payload.task],
          };
        }
      }
    });

    this.eventSource.addEventListener('task_updated', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      if (payload.task) {
        this.board = {
          ...this.board,
          tasks: this.board.tasks.map((t) =>
            t.id === payload.task.id ? payload.task : t,
          ),
        };
      }
    });

    this.eventSource.addEventListener('task_moved', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      if (payload.task) {
        this.board = {
          ...this.board,
          tasks: this.board.tasks.map((t) =>
            t.id === payload.task.id ? payload.task : t,
          ),
        };
      }
    });

    this.eventSource.addEventListener('task_deleted', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      if (payload.taskId) {
        this.board = {
          ...this.board,
          tasks: this.board.tasks.filter((t) => t.id !== payload.taskId),
        };
      }
    });

    this.eventSource.addEventListener('project_created', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      if (payload.project) {
        this.board = {
          ...this.board,
          projects: [...(this.board.projects || []), payload.project],
        };
      }
    });

    this.eventSource.addEventListener('project_updated', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      if (payload.project) {
        this.board = {
          ...this.board,
          projects: (this.board.projects || []).map((p) =>
            p.id === payload.project.id ? payload.project : p,
          ),
        };
      }
    });

    this.eventSource.addEventListener('project_deleted', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      if (payload.projectId) {
        this.board = {
          ...this.board,
          projects: (this.board.projects || []).filter(
            (p) => p.id !== payload.projectId,
          ),
          tasks: (this.board.tasks || []).filter(
            (t) => t.projectId !== payload.projectId,
          ),
        };
      }
    });

    this.eventSource.addEventListener('activity_logged', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      if (payload.activity) {
        this.board = {
          ...this.board,
          activities: [payload.activity, ...(this.board.activities || [])],
        };
      }
    });

    this.eventSource.addEventListener('timesheet_added', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      if (payload.timesheet) {
        this.board = {
          ...this.board,
          timesheets: [payload.timesheet, ...(this.board.timesheets || [])],
        };
      }
    });

    this.eventSource.addEventListener('notification_added', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      if (payload.notification) {
        this.board = {
          ...this.board,
          notifications: [payload.notification, ...(this.board.notifications || [])],
        };
      }
    });
  }

  private handleLoginSuccess(e: CustomEvent<{ user: User }>) {
    this.currentUser = e.detail.user;
    this.loadBoardData();
  }

  private async handleLogout() {
    await logout();
    this.currentUser = null;
    this.activeView = 'dashboard';
  }

  private toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.updateThemeAttribute();
  }

  render() {
    if (!this.authChecked) {
      return html`<div class="loading-screen">INITIALIZING WORKSPACE...</div>`;
    }

    if (!this.currentUser) {
      return html`
        <login-view @login-success=${this.handleLoginSuccess}></login-view>
      `;
    }

    const unreadCount = (this.board.notifications || []).filter(
      (n) =>
        !n.read &&
        (n.userId === this.currentUser?.id || n.userId === 'all'),
    ).length;

    const currentProject = (this.board.projects || []).find(
      (p) => p.id === this.selectedProjectDetailId,
    );

    return html`
      <div class="app-layout">
        <!-- Sidebar Navigation -->
        <nav-sidebar
          .activeView=${this.activeView}
          .currentUser=${this.currentUser}
          @view-change=${(e: CustomEvent<{ view: ActiveView }>) => {
            this.activeView = e.detail.view;
          }}
        ></nav-sidebar>

        <!-- Main Content Wrapper -->
        <div class="main-wrapper">
          <!-- Top Header -->
          <top-header
            .currentUser=${this.currentUser}
            .projects=${this.board.projects || []}
            .selectedProjectId=${this.selectedProjectId}
            .connected=${this.connected}
            .unreadCount=${unreadCount}
            .theme=${this.theme}
            @project-select=${(e: CustomEvent<{ projectId: string }>) => {
              this.selectedProjectId = e.detail.projectId;
            }}
            @theme-toggle=${this.toggleTheme}
            @logout-request=${this.handleLogout}
            @view-change=${(e: CustomEvent<{ view: ActiveView }>) => {
              this.activeView = e.detail.view;
            }}
          ></top-header>

          <!-- Active View -->
          <div class="content-area">
            ${this.activeView === 'dashboard'
              ? html`
                  <dashboard-view
                    .board=${this.board}
                    .currentUser=${this.currentUser}
                    .selectedProjectId=${this.selectedProjectId}
                    @view-change=${(e: CustomEvent<{ view: ActiveView }>) => {
                      this.activeView = e.detail.view;
                    }}
                    @project-detail-select=${(e: CustomEvent<{ projectId: string }>) => {
                      this.selectedProjectDetailId = e.detail.projectId;
                      this.activeView = 'project_details';
                    }}
                  ></dashboard-view>
                `
              : this.activeView === 'projects'
              ? html`
                  <projects-view
                    .projects=${this.board.projects || []}
                    .users=${this.board.users || []}
                    .currentUser=${this.currentUser}
                    @project-detail-select=${(e: CustomEvent<{ projectId: string }>) => {
                      this.selectedProjectDetailId = e.detail.projectId;
                      this.activeView = 'project_details';
                    }}
                    @project-created=${() => this.loadBoardData()}
                    @project-updated=${() => this.loadBoardData()}
                    @project-deleted=${() => this.loadBoardData()}
                  ></projects-view>
                `
              : this.activeView === 'project_details'
              ? html`
                  <project-detail-view
                    .project=${currentProject || null}
                    .tasks=${this.board.tasks || []}
                    .currentUser=${this.currentUser}
                    @view-change=${(e: CustomEvent<{ view: ActiveView; projectId?: string }>) => {
                      if (e.detail.projectId) {
                        this.selectedProjectId = e.detail.projectId;
                      }
                      this.activeView = e.detail.view;
                    }}
                  ></project-detail-view>
                `
              : this.activeView === 'kanban'
              ? html`
                  <kb-board
                    .columns=${this.board.columns || []}
                    .tasks=${this.board.tasks || []}
                    .projects=${this.board.projects || []}
                    .users=${this.board.users || []}
                    .currentUser=${this.currentUser}
                    .selectedProjectId=${this.selectedProjectId}
                    @board-refresh-request=${() => this.loadBoardData()}
                  ></kb-board>
                `
              : this.activeView === 'users' && this.currentUser?.role === 'org_admin'
              ? html`
                  <users-view
                    .users=${this.board.users || []}
                    .currentUser=${this.currentUser}
                    @user-created=${() => this.loadBoardData()}
                    @user-updated=${() => this.loadBoardData()}
                    @user-deleted=${() => this.loadBoardData()}
                  ></users-view>
                `
              : this.activeView === 'teams'
              ? html`
                  <teams-view
                    .teams=${this.board.teams || []}
                    .users=${this.board.users || []}
                    .tasks=${this.board.tasks || []}
                    .currentUser=${this.currentUser}
                    @team-created=${() => this.loadBoardData()}
                    @team-updated=${() => this.loadBoardData()}
                  ></teams-view>
                `
              : this.activeView === 'time_tracking'
              ? html`
                  <time-tracking-view
                    .timesheets=${this.board.timesheets || []}
                    .projects=${this.board.projects || []}
                    .tasks=${this.board.tasks || []}
                    .users=${this.board.users || []}
                    .teams=${this.board.teams || []}
                    .currentUser=${this.currentUser}
                    @timesheet-logged=${() => this.loadBoardData()}
                  ></time-tracking-view>
                `
              : this.activeView === 'calendar'
              ? html`
                  <calendar-view
                    .tasks=${this.board.tasks || []}
                    .projects=${this.board.projects || []}
                    .columns=${this.board.columns || []}
                    .users=${this.board.users || []}
                    .currentUser=${this.currentUser}
                    @project-detail-select=${(e: CustomEvent<{ projectId: string }>) => {
                      this.selectedProjectDetailId = e.detail.projectId;
                      this.activeView = 'project_details';
                    }}
                    @task-created=${() => this.loadBoardData()}
                    @task-updated=${() => this.loadBoardData()}
                    @task-deleted=${() => this.loadBoardData()}
                  ></calendar-view>
                `
              : this.activeView === 'reports'
              ? html`
                  <reports-view
                    .board=${this.board}
                    .currentUser=${this.currentUser}
                  ></reports-view>
                `
              : this.activeView === 'audit_logs'
              ? html`
                  <audit-view
                    .activities=${this.board.activities || []}
                    .currentUser=${this.currentUser}
                  ></audit-view>
                `
              : this.activeView === 'notifications'
              ? html`
                  <notifications-view
                    .notifications=${this.board.notifications || []}
                    .currentUser=${this.currentUser}
                    .teams=${this.board.teams || []}
                    .projects=${this.board.projects || []}
                    .tasks=${this.board.tasks || []}
                    .users=${this.board.users || []}
                    @notification-read=${() => this.loadBoardData()}
                    @notification-sent=${() => this.loadBoardData()}
                  ></notifications-view>
                `
              : this.activeView === 'settings' && this.currentUser?.role === 'org_admin'
              ? html`
                  <settings-view
                    .settings=${this.board.settings}
                    .currentUser=${this.currentUser}
                    @settings-updated=${() => this.loadBoardData()}
                  ></settings-view>
                `
              : html`
                  <dashboard-view
                    .board=${this.board}
                    .currentUser=${this.currentUser}
                    .selectedProjectId=${this.selectedProjectId}
                    @view-change=${(e: CustomEvent<{ view: ActiveView }>) => {
                      this.activeView = e.detail.view;
                    }}
                    @project-detail-select=${(e: CustomEvent<{ projectId: string }>) => {
                      this.selectedProjectDetailId = e.detail.projectId;
                      this.activeView = 'project_details';
                    }}
                  ></dashboard-view>
                `}
          </div>
        </div>
      </div>
    `;
  }
}
