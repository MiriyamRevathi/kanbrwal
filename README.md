# Kanbrawl Enterprise Project Management Web Application

Kanbrawl Enterprise is a commercial-grade, multi-role project management web platform built for high-velocity software engineering teams and autonomous AI agents. It features full role-based access control (RBAC), multi-project portfolio management, a 6-column interactive Kanban board, team capacity tracking, labor timesheets, system compliance audit logging, a local machine learning project risk engine, real-time Server-Sent Events (SSE) synchronization, and direct integration with AI agents via the Model Context Protocol (MCP).

---

## 1. System Highlights

- **Web-First Architecture**: Intuitive, high-density web application accessible directly in any modern browser with zero CLI requirement.
- **Strict No-Database Design**: 100% local JSON file persistence (`data/`) utilizing atomic temporary file writes and sync renames to guarantee data integrity without database overhead.
- **Role-Based Access Control (RBAC)**: Enforced both on the backend REST layer and dynamic frontend UI across 6 standard enterprise roles (*Super Admin, Organization Admin, Project Manager, Team Lead, Employee, Viewer*).
- **AI Agent Integration via MCP**: Native HTTP (`/mcp`) and stdio transport exposing 12 granular project and task management tools for AI agents.
- **Instant Real-Time Synchronization**: Backend mutation events are broadcasted via Server-Sent Events (`/events`) so changes made by humans or AI agents reflect instantly across all open browser tabs without manual page reload.
- **Local Machine Learning Risk Engine**: Deterministic multi-factor risk assessment analyzing overdue tasks, blocker ratios, P0 pending items, deadline pressure, and labor hour variance to categorize project risk (Low, Medium, High).
- **Strict No-Icon Enterprise UI**: Purpose-built typography, spacing, status badges, metric tiles, and text-based controls providing a professional commercial aesthetic without third-party icon dependencies.
- **Data Export**: Immediate extraction of projects, tasks, timesheets, and audit trails in CSV and JSON formats.

---

## 2. Seed Data & Demo Accounts

On initial launch, Kanbrawl automatically initializes realistic enterprise projects, users, teams, deliverables, timesheets, and audit logs inside `data/`.

### Demo Login Accounts

| Role | Email | Password | Access & Permissions |
|---|---|---|---|
| **Super Admin** | `superadmin@enterprise.com` | `admin123` | Full administrative control: User management, system settings, all projects, audit trail |
| **Organization Admin** | `orgadmin@enterprise.com` | `admin123` | Organization level control: Manage users, teams, projects, and portfolio reports |
| **Project Manager** | `pm@enterprise.com` | `pm123` | Project leadership: Create/edit projects, allocate tasks, adjust priorities, analyze ML risk |
| **Team Lead** | `lead@enterprise.com` | `lead123` | Squad lead: Manage team deliverables, assign tasks to engineers, review progress |
| **Employee** | `employee@enterprise.com` | `emp123` | Engineer / IC: View deliverables, update progress, move task status, log labor time |
| **Viewer** | `viewer@enterprise.com` | `view123` | Stakeholder / Auditor: Read-only access across boards, projects, and reports |

*Passwords are securely hashed using salted SHA-256 digests in `data/users.json`.*

### Seeded Enterprise Projects
1. **E-Commerce Platform (`ECOM`)**: Omni-channel checkout, Stripe/PayPal payment gateway, Redis flash-sale inventory sync.
2. **Hospital Management System (`HOSP`)**: HIPAA-compliant Electronic Health Records (EHR), emergency room triage queue, HL7 FHIR pipelines.
3. **Mobile Banking Application (`MBANK`)**: Biometric auth (FaceID/TouchID), instant P2P transfer engine with fraud heuristics.
4. **College Management Portal (`CAMPUS`)**: Student course enrollment engine, faculty grade submission, and academic transcripts.

---

## 3. Architecture & Data Store

Kanbrawl requires **no external database** (no PostgreSQL, MySQL, SQLite, MongoDB, Firebase, or Supabase). All entity collections are persisted in structured JSON files under `data/`:

```
data/
├── users.json          # User identities, credentials, role mappings
├── projects.json       # Projects, roadmaps, budgets, ML risk metrics
├── tasks.json          # Kanban tasks, priorities, assignees, tags
├── teams.json          # Cross-functional squads and team lead rosters
├── columns.json        # 6-column pipeline configuration and sorting
├── timesheets.json     # Logged labor hours and task references
├── activities.json     # Compliance audit trail and mutation events
├── notifications.json  # In-app notifications and alerts
└── settings.json       # Organization settings and ML thresholds
```

### Atomic File Writes
To prevent file corruption during concurrent operations from web requests and AI agent MCP tool calls, the store writes to a unique temporary file (`.tmp`) in the target directory and performs an atomic filesystem rename:
```
temp_file = data/{filename}.{uuid}.tmp
write(temp_file, json_data)
rename(temp_file, data/{filename})
```

---

## 4. Local ML Project Risk Engine

The application includes an embedded local machine learning engine (`src/server/ml/risk-engine.ts`) that scores project delivery risk from 0 to 100 with zero external API calls:

$$\text{Risk Score} = 0.28(\text{Overdue}) + 0.22(\text{Blocked}) + 0.20(\text{P0 Pending}) + 0.15(\text{Deadline Pressure}) + 0.10(\text{Hours Overrun}) + 0.05(\text{Unassigned})$$

- **Low Risk (< 35)**: Nominal sprint metrics and on-time velocity.
- **Medium Risk (35 - 65)**: Moderate blockers or approaching deadline pressure.
- **High Risk (> 65)**: Critical blockers, overdue deliverables, or budget overruns requiring intervention.

---

## 5. Model Context Protocol (MCP) Integration

Kanbrawl exposes a standard Model Context Protocol (MCP) server accessible via HTTP (`/mcp`) and stdio transport.

### Available MCP Tools

| Tool Name | Parameters | Description |
|---|---|---|
| `get_projects` | None | Lists all projects with status, task stats, and ML risk scores |
| `get_project` | `id` (string) | Retrieves full project metadata and risk assessment |
| `get_columns` | None | Returns the 6 Kanban columns with active task counts |
| `list_tasks` | `projectId`, `column`, `priority`, `assignee`, `search`, `max` | Queries and filters tasks across projects |
| `get_task` | `id` (string) | Retrieves detailed task information |
| `create_task` | `title`, `description`, `projectId`, `column`, `priority`, `assignee`, `dueDate`, `estimatedHours`, `tags`, `riskLevel` | Creates a new task and broadcasts SSE update |
| `update_task` | `id`, `title`, `description`, `column`, `priority`, `assignee`, `dueDate`, `estimatedHours`, `actualHours`, `tags`, `riskLevel`, `riskNotes` | Modifies existing task fields |
| `move_task` | `id`, `column` | Moves task between Kanban columns |
| `delete_task` | `id` | Permanently deletes a task |
| `assign_task` | `id`, `assignee` | Assigns task ownership to a user |
| `get_project_risk` | `projectId` | Returns ML risk score, factors, and recommendations |
| `get_project_summary` | `projectId` | Generates executive summary of project health |

---

## 6. Installation & Running

### Prerequisites
- Node.js >= 22.0.0
- npm >= 10.0.0

### Exact Deterministic Installation
```bash
npm ci
```
*(or `npm install`)*

### Build Application
```bash
npm run build
```

### Run Production Server Locally
```bash
npm start
```
The server will start on `http://localhost:8431`.

### Run in Development Mode (Live Watch & Hot Reload)
```bash
npm run dev
```

---

## 7. Docker Deployment

The application is fully containerized with persistent storage for the JSON data directory.

### Build and Run with Docker Compose
```bash
docker-compose up --build -d
```

### Build and Run with Docker Directly
```bash
# 1. Build image
docker build -t kanbrawl-enterprise .

# 2. Run container with persistent data volume
docker run -d -p 8431:8431 -v kanbrawl_data:/app/data --name kanbrawl kanbrawl-enterprise
```

---

## 8. Verification & Automated Testing

Run the Vitest test suite covering authentication, RBAC authorization, atomic JSON persistence, MCP tools, ML risk engine, and REST endpoints:

```bash
npm test
```

---

## 9. Project Structure

```
.
├── Dockerfile                  # Production container definition
├── docker-compose.yml          # Compose specification with volume persistence
├── package.json                # Project dependencies and lifecycle scripts
├── package-lock.json           # Deterministic package lockfile
├── tsconfig.json               # TypeScript compiler options
├── vitest.config.ts            # Test runner configuration
├── data/                       # Local JSON database directory
├── src/
│   ├── client/                 # Lit + TypeScript Enterprise Web UI
│   │   ├── index.html          # Web application entry page
│   │   ├── src/
│   │   │   ├── app.ts          # Main application router and state store
│   │   │   ├── api.ts          # REST client and SSE subscriber
│   │   │   ├── styles.ts       # Design system tokens (strict no-icon design)
│   │   │   ├── types.ts        # Frontend entity interfaces
│   │   │   └── components/     # UI Views & Components
│   │   │       ├── nav-sidebar.ts         # Left navigation sidebar
│   │   │       ├── top-header.ts          # Global header with status and profile
│   │   │       ├── login-view.ts          # Enterprise sign-in view
│   │   │       ├── dashboard-view.ts      # Executive metrics dashboard
│   │   │       ├── projects-view.ts       # Project portfolio management
│   │   │       ├── project-detail-view.ts # Deep dive project analytics
│   │   │       ├── board.ts               # Kanban board orchestrator
│   │   │       ├── column.ts              # Drag-and-drop Kanban column
│   │   │       ├── task.ts                # Task card component
│   │   │       ├── task-modal.ts          # Task detail & editing modal
│   │   │       ├── users-view.ts          # User directory & RBAC provisioning
│   │   │       ├── teams-view.ts          # Team rosters and workload
│   │   │       ├── time-tracking-view.ts  # Work timer and labor timesheets
│   │   │       ├── calendar-view.ts       # Delivery schedule and milestones
│   │   │       ├── reports-view.ts        # Reports and CSV/JSON export
│   │   │       ├── audit-view.ts          # System compliance audit trail
│   │   │       ├── notifications-view.ts  # In-app notifications
│   │   │       └── settings-view.ts       # Configuration & demo reset
│   └── server/                 # Enterprise Backend Layer
│       ├── index.ts            # Server entry point (Express, MCP, SSE)
│       ├── api.ts              # REST API routes and endpoints
│       ├── sse.ts              # Real-time Server-Sent Events manager
│       ├── tools.ts            # Model Context Protocol (MCP) tool registrations
│       ├── types.ts            # Backend domain types
│       ├── auth/               # Authentication & Authorization
│       │   ├── auth-service.ts # Session registry and login handler
│       │   ├── crypto.ts       # Salted SHA-256 password hashing
│       │   └── middleware.ts   # RBAC permission middleware
│       ├── ml/                 # Local ML Risk Prediction
│       │   └── risk-engine.ts  # Multi-factor risk calculation engine
│       └── store/              # Data Persistence Layer
│           ├── file-store.ts   # Atomic JSON persistence engine
│           └── seed-data.ts    # Demo data generator
└── dist/                       # Compiled production outputs
```

---

## 10. License

MIT License.
