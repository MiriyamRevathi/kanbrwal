import type { UserRole, RiskLevel, Priority } from '../types.js';

export type EnterpriseSystemDomain =
  | 'core_identity'
  | 'project_governance'
  | 'task_execution'
  | 'time_accounting'
  | 'risk_telemetry'
  | 'notification_hub'
  | 'integration_gateway'
  | 'audit_compliance';

export type MicroserviceContract = {
  serviceId: string;
  serviceName: string;
  domain: EnterpriseSystemDomain;
  version: string;
  endpoints: {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    requiredRoles: UserRole[];
    rateLimitPerMinute: number;
    description: string;
  }[];
  healthCheckPath: string;
  dependencies: string[];
};

export class EnterpriseArchitectureRegistry {
  private services: Map<string, MicroserviceContract> = new Map();

  constructor() {
    this.initializeArchitectureMap();
  }

  private initializeArchitectureMap(): void {
    const coreServices: MicroserviceContract[] = [
      {
        serviceId: 'svc_auth_identity',
        serviceName: 'Identity & Access Management (IAM) Service',
        domain: 'core_identity',
        version: '2.4.0',
        endpoints: [
          { path: '/api/auth/login', method: 'POST', requiredRoles: [], rateLimitPerMinute: 60, description: 'Authenticate user session and issue JWT/bearer token.' },
          { path: '/api/auth/me', method: 'GET', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 300, description: 'Retrieve current authenticated user context.' },
          { path: '/api/users', method: 'GET', requiredRoles: ['org_admin'], rateLimitPerMinute: 120, description: 'List all organization user profiles.' },
          { path: '/api/users', method: 'POST', requiredRoles: ['org_admin'], rateLimitPerMinute: 30, description: 'Provision new user account.' },
          { path: '/api/users/:id', method: 'PATCH', requiredRoles: ['org_admin'], rateLimitPerMinute: 60, description: 'Update user account profile or status.' },
          { path: '/api/users/:id', method: 'DELETE', requiredRoles: ['org_admin'], rateLimitPerMinute: 20, description: 'Deprovision user account.' },
        ],
        healthCheckPath: '/healthz/identity',
        dependencies: [],
      },
      {
        serviceId: 'svc_project_governance',
        serviceName: 'Project & Portfolio Management (PPM) Service',
        domain: 'project_governance',
        version: '3.1.0',
        endpoints: [
          { path: '/api/projects', method: 'GET', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 300, description: 'List portfolio projects.' },
          { path: '/api/projects/:id', method: 'GET', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 300, description: 'Get detailed project metrics and breakdown.' },
          { path: '/api/projects', method: 'POST', requiredRoles: ['org_admin', 'project_manager'], rateLimitPerMinute: 30, description: 'Create new enterprise project.' },
          { path: '/api/projects/:id', method: 'PATCH', requiredRoles: ['org_admin', 'project_manager'], rateLimitPerMinute: 60, description: 'Update project attributes and target dates.' },
          { path: '/api/projects/:id', method: 'DELETE', requiredRoles: ['org_admin'], rateLimitPerMinute: 15, description: 'Archive and delete project portfolio.' },
        ],
        healthCheckPath: '/healthz/projects',
        dependencies: ['svc_auth_identity'],
      },
      {
        serviceId: 'svc_task_kanban',
        serviceName: 'Kanban Delivery & Task Engine',
        domain: 'task_execution',
        version: '4.0.0',
        endpoints: [
          { path: '/api/tasks', method: 'GET', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 600, description: 'Fetch filtered task board.' },
          { path: '/api/tasks/:id', method: 'GET', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 600, description: 'Get task detail record.' },
          { path: '/api/tasks', method: 'POST', requiredRoles: ['org_admin', 'project_manager', 'team_lead'], rateLimitPerMinute: 120, description: 'Create new task deliverable.' },
          { path: '/api/tasks/:id', method: 'PATCH', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee'], rateLimitPerMinute: 300, description: 'Update task attributes or move Kanban status.' },
          { path: '/api/tasks/:id', method: 'DELETE', requiredRoles: ['org_admin', 'project_manager', 'team_lead'], rateLimitPerMinute: 60, description: 'Delete task deliverable.' },
          { path: '/api/columns', method: 'GET', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 600, description: 'Fetch board column configuration.' },
          { path: '/api/columns', method: 'PUT', requiredRoles: ['org_admin', 'project_manager'], rateLimitPerMinute: 30, description: 'Update board columns reordering.' },
        ],
        healthCheckPath: '/healthz/kanban',
        dependencies: ['svc_auth_identity', 'svc_project_governance'],
      },
      {
        serviceId: 'svc_time_tracking',
        serviceName: 'Timesheet & Effort Accounting Engine',
        domain: 'time_accounting',
        version: '1.8.0',
        endpoints: [
          { path: '/api/timesheets', method: 'GET', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 300, description: 'List logged timesheets.' },
          { path: '/api/timesheets', method: 'POST', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee'], rateLimitPerMinute: 120, description: 'Log labor hours on task deliverable.' },
        ],
        healthCheckPath: '/healthz/timesheets',
        dependencies: ['svc_auth_identity', 'svc_task_kanban'],
      },
      {
        serviceId: 'svc_risk_telemetry',
        serviceName: 'ML Risk Analysis & Telemetry Engine',
        domain: 'risk_telemetry',
        version: '2.0.0',
        endpoints: [
          { path: '/api/risk/project/:id', method: 'GET', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 300, description: 'Assess project risk score.' },
          { path: '/api/risk/overview', method: 'GET', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 300, description: 'Get portfolio risk overview map.' },
        ],
        healthCheckPath: '/healthz/risk',
        dependencies: ['svc_project_governance', 'svc_task_kanban'],
      },
      {
        serviceId: 'svc_notification_hub',
        serviceName: 'Notification & Messaging Hub',
        domain: 'notification_hub',
        version: '3.5.0',
        endpoints: [
          { path: '/api/notifications', method: 'GET', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 600, description: 'Fetch notifications for authenticated user.' },
          { path: '/api/notifications', method: 'POST', requiredRoles: ['org_admin', 'project_manager', 'team_lead'], rateLimitPerMinute: 60, description: 'Send manual notification or announcement.' },
          { path: '/api/notifications/:id/read', method: 'PATCH', requiredRoles: ['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'], rateLimitPerMinute: 600, description: 'Mark notification read status.' },
        ],
        healthCheckPath: '/healthz/notifications',
        dependencies: ['svc_auth_identity'],
      },
    ];

    for (const svc of coreServices) {
      this.services.set(svc.serviceId, svc);
    }
  }

  public getServiceCatalog(): MicroserviceContract[] {
    return Array.from(this.services.values());
  }

  public validateEndpointAccess(path: string, method: string, role: UserRole): boolean {
    for (const svc of this.services.values()) {
      for (const ep of svc.endpoints) {
        if (ep.path === path && ep.method === method) {
          if (ep.requiredRoles.length === 0) return true;
          return ep.requiredRoles.includes(role);
        }
      }
    }
    return true; // default allow for non-registered paths
  }
}

export const globalArchitectureRegistry = new EnterpriseArchitectureRegistry();
