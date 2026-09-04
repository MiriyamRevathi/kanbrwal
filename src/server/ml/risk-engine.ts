import type { Project, Task, RiskLevel, Priority } from '../types.js';

export type RiskAssessment = {
  projectId: string;
  projectName: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0 - 100
  confidence: number; // 0 - 100
  riskFactors: string[];
  metrics: {
    totalTasks: number;
    completedTasks: number;
    completionPercentage: number;
    overdueTasks: number;
    blockedTasks: number;
    p0UnfinishedTasks: number;
    unassignedTasks: number;
    estimatedHoursTotal: number;
    actualHoursTotal: number;
    hoursVariancePercentage: number;
    daysRemaining: number;
    deadlinePressureScore: number;
  };
  recommendations: string[];
};

export class MLRiskEngine {
  /**
   * Deterministic local ML risk assessment based on multi-factor feature vector regression
   */
  public static assessProjectRisk(project: Project, allTasks: Task[]): RiskAssessment {
    const projectTasks = allTasks.filter((t) => t.projectId === project.id);
    const totalTasks = projectTasks.length;

    const completedTasks = projectTasks.filter(
      (t) => t.column.toLowerCase() === 'done',
    ).length;
    const nonDoneTasks = projectTasks.filter(
      (t) => t.column.toLowerCase() !== 'done',
    );
    const blockedTasks = projectTasks.filter(
      (t) => t.column.toLowerCase() === 'blocked',
    ).length;
    const p0Unfinished = nonDoneTasks.filter((t) => t.priority === 'P0').length;
    const unassignedTasks = nonDoneTasks.filter(
      (t) => !t.assigneeId && (!t.assignee || t.assignee.trim() === ''),
    ).length;

    const now = new Date();
    const overdueTasks = nonDoneTasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due.getTime() < now.getTime();
    }).length;

    const estimatedHoursTotal = projectTasks.reduce(
      (sum, t) => sum + (t.estimatedHours || 0),
      0,
    );
    const actualHoursTotal = projectTasks.reduce(
      (sum, t) => sum + (t.actualHours || 0),
      0,
    );

    const completionPercentage =
      totalTasks === 0 ? 100 : Math.round((completedTasks / totalTasks) * 100);

    const hoursVariancePercentage =
      estimatedHoursTotal === 0
        ? 0
        : Math.round(
            ((actualHoursTotal - estimatedHoursTotal) / estimatedHoursTotal) * 100,
          );

    // Deadline analysis
    const targetDate = project.targetDate ? new Date(project.targetDate) : null;
    let daysRemaining = 30;
    if (targetDate) {
      const diffMs = targetDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    // Deadline pressure score: 0 (safe) to 100 (critical)
    let deadlinePressureScore = 0;
    if (daysRemaining <= 0 && nonDoneTasks.length > 0) {
      deadlinePressureScore = 100;
    } else if (daysRemaining < 7 && nonDoneTasks.length > 2) {
      deadlinePressureScore = 85;
    } else if (daysRemaining < 14 && nonDoneTasks.length > 5) {
      deadlinePressureScore = 60;
    } else if (daysRemaining < 30 && completionPercentage < 40) {
      deadlinePressureScore = 45;
    } else {
      deadlinePressureScore = 15;
    }

    // Feature Weights for Enterprise Risk Model
    // 1. Overdue tasks factor (Weight: 28%)
    const overdueRatio =
      nonDoneTasks.length === 0 ? 0 : overdueTasks / nonDoneTasks.length;
    const overdueScore = Math.min(100, overdueRatio * 150);

    // 2. Blocked tasks factor (Weight: 22%)
    const blockedRatio =
      nonDoneTasks.length === 0 ? 0 : blockedTasks / nonDoneTasks.length;
    const blockedScore = Math.min(100, blockedRatio * 200);

    // 3. P0 unfinished factor (Weight: 20%)
    const p0Ratio =
      nonDoneTasks.length === 0 ? 0 : p0Unfinished / nonDoneTasks.length;
    const p0Score = Math.min(100, p0Ratio * 130);

    // 4. Deadline pressure factor (Weight: 15%)
    const deadlineScore = deadlinePressureScore;

    // 5. Hours overrun factor (Weight: 10%)
    const hoursOverrunScore =
      hoursVariancePercentage > 0
        ? Math.min(100, hoursVariancePercentage * 2)
        : 0;

    // 6. Unassigned tasks factor (Weight: 5%)
    const unassignedScore =
      nonDoneTasks.length === 0 ? 0 : Math.min(100, (unassignedTasks / nonDoneTasks.length) * 100);

    // Weighted composite risk calculation
    const rawRiskScore =
      0.28 * overdueScore +
      0.22 * blockedScore +
      0.20 * p0Score +
      0.15 * deadlineScore +
      0.10 * hoursOverrunScore +
      0.05 * unassignedScore;

    const riskScore = Math.min(100, Math.max(0, Math.round(rawRiskScore)));

    // Risk Classification
    let riskLevel: RiskLevel = 'low';
    if (riskScore >= 65) {
      riskLevel = 'high';
    } else if (riskScore >= 35) {
      riskLevel = 'medium';
    }

    // Factors & Recommendations
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    if (overdueTasks > 0) {
      riskFactors.push(`${overdueTasks} task${overdueTasks > 1 ? 's are' : ' is'} past deadline`);
      recommendations.push('Re-evaluate timeline and reassign overdue deliverables to expedite turnaround.');
    }

    if (blockedTasks > 0) {
      riskFactors.push(`${blockedTasks} task${blockedTasks > 1 ? 's are' : ' is'} currently blocked by dependencies`);
      recommendations.push('Conduct a blocker triage session with technical leads to resolve external blockers.');
    }

    if (p0Unfinished > 0) {
      riskFactors.push(`${p0Unfinished} critical P0 task${p0Unfinished > 1 ? 's' : ''} remaining in progress`);
      recommendations.push('Dedicate senior engineering resources to high-priority P0 items.');
    }

    if (daysRemaining <= 7 && nonDoneTasks.length > 0) {
      riskFactors.push(`Approaching target deadline in ${Math.max(0, daysRemaining)} days with ${nonDoneTasks.length} pending items`);
      recommendations.push('Scope down non-essential backlog items for the upcoming milestone release.');
    }

    if (hoursVariancePercentage > 15) {
      riskFactors.push(`Actual effort exceeds estimate by ${hoursVariancePercentage}%`);
      recommendations.push('Audit task estimation fidelity and adjust sprint capacity buffers.');
    }

    if (unassignedTasks > 0) {
      riskFactors.push(`${unassignedTasks} active task${unassignedTasks > 1 ? 's' : ''} without designated assignee`);
      recommendations.push('Assign clear task ownership to prevent idle cycle waste.');
    }

    if (riskFactors.length === 0) {
      riskFactors.push('Project execution metrics are within healthy nominal ranges');
      recommendations.push('Continue standard sprint cadence and milestone tracking.');
    }

    // Confidence metric based on sample size of tasks & logged hours
    const confidence = Math.min(95, Math.max(60, 60 + totalTasks * 3));

    return {
      projectId: project.id,
      projectName: project.name,
      riskLevel,
      riskScore,
      confidence,
      riskFactors,
      metrics: {
        totalTasks,
        completedTasks,
        completionPercentage,
        overdueTasks,
        blockedTasks,
        p0UnfinishedTasks: p0Unfinished,
        unassignedTasks,
        estimatedHoursTotal,
        actualHoursTotal,
        hoursVariancePercentage,
        daysRemaining,
        deadlinePressureScore,
      },
      recommendations,
    };
  }

  public static assessAll(projects: Project[], tasks: Task[]): Record<string, RiskAssessment> {
    const results: Record<string, RiskAssessment> = {};
    for (const project of projects) {
      results[project.id] = this.assessProjectRisk(project, tasks);
    }
    return results;
  }
}
