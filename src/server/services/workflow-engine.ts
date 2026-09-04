import type { Task, Project, UserRole, Activity } from '../types.js';

export type WorkflowState = 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'in_review' | 'completed' | 'rejected' | 'archived';

export type WorkflowTransition = {
  id: string;
  fromState: WorkflowState;
  toState: WorkflowState;
  actionName: string;
  requiredRole: UserRole[];
  requireComment: boolean;
  autoTriggers: string[];
};

export type ApprovalStep = {
  stepNumber: number;
  approverRole: UserRole;
  approverUserId?: string;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  timestamp?: string;
};

export type WorkflowInstance = {
  id: string;
  entityId: string;
  entityType: 'project' | 'task';
  currentState: WorkflowState;
  previousState?: WorkflowState;
  initiatorId: string;
  approvalChain: ApprovalStep[];
  history: {
    timestamp: string;
    fromState: WorkflowState;
    toState: WorkflowState;
    performedById: string;
    performedByName: string;
    comment?: string;
  }[];
  createdAt: string;
  updatedAt: string;
};

export class EnterpriseWorkflowEngine {
  private transitions: Map<string, WorkflowTransition[]> = new Map();
  private instances: Map<string, WorkflowInstance> = new Map();

  constructor() {
    this.initializeDefaultTransitions();
  }

  private initializeDefaultTransitions(): void {
    const defaultTaskTransitions: WorkflowTransition[] = [
      {
        id: 'trans_submit_draft',
        fromState: 'draft',
        toState: 'pending_approval',
        actionName: 'Submit for Approval',
        requiredRole: ['employee', 'team_lead', 'project_manager', 'org_admin'],
        requireComment: false,
        autoTriggers: ['notify_approver'],
      },
      {
        id: 'trans_approve_task',
        fromState: 'pending_approval',
        toState: 'approved',
        actionName: 'Approve Task Request',
        requiredRole: ['team_lead', 'project_manager', 'org_admin'],
        requireComment: false,
        autoTriggers: ['move_to_todo'],
      },
      {
        id: 'trans_reject_task',
        fromState: 'pending_approval',
        toState: 'rejected',
        actionName: 'Reject Task Request',
        requiredRole: ['team_lead', 'project_manager', 'org_admin'],
        requireComment: true,
        autoTriggers: ['notify_initiator'],
      },
      {
        id: 'trans_start_work',
        fromState: 'approved',
        toState: 'in_progress',
        actionName: 'Start Task Execution',
        requiredRole: ['employee', 'team_lead', 'project_manager', 'org_admin'],
        requireComment: false,
        autoTriggers: ['log_start_activity'],
      },
      {
        id: 'trans_submit_review',
        fromState: 'in_progress',
        toState: 'in_review',
        actionName: 'Submit Deliverable for QA Review',
        requiredRole: ['employee', 'team_lead', 'project_manager', 'org_admin'],
        requireComment: true,
        autoTriggers: ['notify_qa_lead'],
      },
      {
        id: 'trans_pass_review',
        fromState: 'in_review',
        toState: 'completed',
        actionName: 'Mark Deliverable Completed & Verified',
        requiredRole: ['team_lead', 'project_manager', 'org_admin'],
        requireComment: false,
        autoTriggers: ['update_kanban_done', 'recalculate_earned_value'],
      },
      {
        id: 'trans_request_changes',
        fromState: 'in_review',
        toState: 'in_progress',
        actionName: 'Request Rework / Re-assign',
        requiredRole: ['team_lead', 'project_manager', 'org_admin'],
        requireComment: true,
        autoTriggers: ['notify_assignee'],
      },
    ];

    this.transitions.set('task_default', defaultTaskTransitions);
  }

  public createInstance(entityId: string, entityType: 'project' | 'task', initiatorId: string): WorkflowInstance {
    const instance: WorkflowInstance = {
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      entityId,
      entityType,
      currentState: 'draft',
      initiatorId,
      approvalChain: [
        { stepNumber: 1, approverRole: 'team_lead', status: 'pending' },
        { stepNumber: 2, approverRole: 'project_manager', status: 'pending' },
      ],
      history: [
        {
          timestamp: new Date().toISOString(),
          fromState: 'draft',
          toState: 'draft',
          performedById: initiatorId,
          performedByName: 'Workflow Initiator',
          comment: 'Workflow instance created.',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.instances.set(instance.id, instance);
    return instance;
  }

  public getAvailableTransitions(instanceId: string, userRole: UserRole): WorkflowTransition[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];

    const transitions = this.transitions.get('task_default') || [];
    return transitions.filter(
      (t) => t.fromState === instance.currentState && t.requiredRole.includes(userRole),
    );
  }

  public executeTransition(
    instanceId: string,
    transitionId: string,
    userId: string,
    userName: string,
    userRole: UserRole,
    comment?: string,
  ): WorkflowInstance {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance "${instanceId}" not found.`);
    }

    const available = this.getAvailableTransitions(instanceId, userRole);
    const transition = available.find((t) => t.id === transitionId);
    if (!transition) {
      throw new Error(
        `Transition "${transitionId}" is not allowed for role "${userRole}" in state "${instance.currentState}".`,
      );
    }

    if (transition.requireComment && (!comment || comment.trim().length === 0)) {
      throw new Error(`Transition "${transition.actionName}" requires an explanatory comment.`);
    }

    instance.previousState = instance.currentState;
    instance.currentState = transition.toState;
    instance.updatedAt = new Date().toISOString();

    instance.history.push({
      timestamp: new Date().toISOString(),
      fromState: instance.previousState,
      toState: instance.currentState,
      performedById: userId,
      performedByName: userName,
      comment,
    });

    return instance;
  }

  public getInstance(instanceId: string): WorkflowInstance | undefined {
    return this.instances.get(instanceId);
  }

  public evaluateRuleMatrix(project: Project, tasks: Task[]): {
    canAutoApprove: boolean;
    recommendedSignOffRole: UserRole;
    riskAdjustedScore: number;
    auditFlag: boolean;
  } {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.column.toLowerCase() === 'done').length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const highRiskTasks = tasks.filter((t) => t.riskLevel === 'high').length;

    let canAutoApprove = false;
    let recommendedSignOffRole: UserRole = 'team_lead';
    let riskAdjustedScore = project.riskScore || 0;
    let auditFlag = false;

    if (completionRate > 80 && highRiskTasks === 0 && riskAdjustedScore < 30) {
      canAutoApprove = true;
    }

    if (riskAdjustedScore > 65 || highRiskTasks > 2) {
      recommendedSignOffRole = 'org_admin';
      auditFlag = true;
    } else if (riskAdjustedScore > 40) {
      recommendedSignOffRole = 'project_manager';
    }

    return {
      canAutoApprove,
      recommendedSignOffRole,
      riskAdjustedScore,
      auditFlag,
    };
  }

  public generateWorkflowReport(instanceIds: string[]): {
    totalWorkflows: number;
    completedWorkflows: number;
    averageCycleTimeHours: number;
    rejectionRate: number;
  } {
    const list = instanceIds.map((id) => this.instances.get(id)).filter(Boolean) as WorkflowInstance[];
    const totalWorkflows = list.length;
    const completedWorkflows = list.filter((w) => w.currentState === 'completed').length;
    const rejectedWorkflows = list.filter((w) => w.currentState === 'rejected').length;

    let totalDurationMs = 0;
    let durationCount = 0;

    for (const w of list) {
      if (w.history.length > 1) {
        const start = new Date(w.createdAt).getTime();
        const end = new Date(w.updatedAt).getTime();
        totalDurationMs += end - start;
        durationCount++;
      }
    }

    const averageCycleTimeHours = durationCount > 0 ? Math.round((totalDurationMs / (1000 * 3600 * durationCount)) * 10) / 10 : 0;
    const rejectionRate = totalWorkflows > 0 ? Math.round((rejectedWorkflows / totalWorkflows) * 100) : 0;

    return {
      totalWorkflows,
      completedWorkflows,
      averageCycleTimeHours,
      rejectionRate,
    };
  }
}

export const globalWorkflowEngine = new EnterpriseWorkflowEngine();
