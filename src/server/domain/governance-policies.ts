import type { UserRole } from '../types.js';

export type PolicyDomain = 'authentication' | 'data_retention' | 'rbac' | 'audit_logging' | 'encryption';

export type GovernancePolicy = {
  policyId: string;
  name: string;
  domain: PolicyDomain;
  version: string;
  mandatory: boolean;
  rules: {
    ruleCode: string;
    description: string;
    targetRoles: UserRole[];
    enforcementLevel: 'strict' | 'warning' | 'audit_only';
  }[];
  lastAudited: string;
};

export class EnterpriseGovernanceEngine {
  private policies: Map<string, GovernancePolicy> = new Map();

  constructor() {
    this.initializePolicies();
  }

  private initializePolicies(): void {
    const defaultPolicies: GovernancePolicy[] = [
      {
        policyId: 'pol_rbac_5role',
        name: '5-Role Access Control Standard Policy',
        domain: 'rbac',
        version: '2.0',
        mandatory: true,
        rules: [
          {
            ruleCode: 'POL-RBAC-01',
            description: 'Organization Admin has full system user management, settings modification, project deletion, and notification sending authority.',
            targetRoles: ['org_admin'],
            enforcementLevel: 'strict',
          },
          {
            ruleCode: 'POL-RBAC-02',
            description: 'Project Managers can manage projects, tasks, columns, timesheets, and send notifications.',
            targetRoles: ['project_manager'],
            enforcementLevel: 'strict',
          },
          {
            ruleCode: 'POL-RBAC-03',
            description: 'Team Leads can manage team tasks, view team timesheets, add team members, and send notifications.',
            targetRoles: ['team_lead'],
            enforcementLevel: 'strict',
          },
          {
            ruleCode: 'POL-RBAC-04',
            description: 'Employees can log timesheets and update assigned task status.',
            targetRoles: ['employee'],
            enforcementLevel: 'strict',
          },
          {
            ruleCode: 'POL-RBAC-05',
            description: 'Viewers have strict read-only access across all views and endpoints.',
            targetRoles: ['viewer'],
            enforcementLevel: 'strict',
          },
        ],
        lastAudited: new Date().toISOString(),
      },
      {
        policyId: 'pol_audit_trail',
        name: 'Continuous Audit Trail & Traceability Policy',
        domain: 'audit_logging',
        version: '1.5',
        mandatory: true,
        rules: [
          {
            ruleCode: 'POL-AUD-01',
            description: 'Every state mutation (project, task, timesheet, notification) must generate an activity record.',
            targetRoles: ['org_admin', 'project_manager', 'team_lead', 'employee'],
            enforcementLevel: 'strict',
          },
          {
            ruleCode: 'POL-AUD-02',
            description: 'Manual notifications must store sender ID, name, and role for full accountability.',
            targetRoles: ['org_admin', 'project_manager', 'team_lead'],
            enforcementLevel: 'strict',
          },
        ],
        lastAudited: new Date().toISOString(),
      },
    ];

    for (const p of defaultPolicies) {
      this.policies.set(p.policyId, p);
    }
  }

  public getPolicies(): GovernancePolicy[] {
    return Array.from(this.policies.values());
  }

  public auditRoleCompliance(userRole: UserRole, actionName: string): { allowed: boolean; ruleCode?: string } {
    if (userRole === 'viewer') {
      const allowedReadActions = ['read', 'get', 'list', 'fetch', 'view'];
      const isReadOnly = allowedReadActions.some((a) => actionName.toLowerCase().includes(a));
      return { allowed: isReadOnly, ruleCode: 'POL-RBAC-05' };
    }

    if (actionName === 'send_notification') {
      const allowed = ['org_admin', 'project_manager', 'team_lead'].includes(userRole);
      return { allowed, ruleCode: 'POL-AUD-02' };
    }

    if (actionName === 'delete_user' || actionName === 'update_settings') {
      const allowed = userRole === 'org_admin';
      return { allowed, ruleCode: 'POL-RBAC-01' };
    }

    return { allowed: true };
  }
}

export const globalGovernanceEngine = new EnterpriseGovernanceEngine();
