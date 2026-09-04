import type { Project, Task, TimesheetEntry, User } from '../types.js';

export type EarnedValueMetrics = {
  projectId: string;
  projectName: string;
  plannedValue: number; // PV ($ or hours)
  earnedValue: number;  // EV ($ or hours)
  actualCost: number;   // AC ($ or hours)
  costVariance: number; // CV = EV - AC
  scheduleVariance: number; // SV = EV - PV
  costPerformanceIndex: number; // CPI = EV / AC
  schedulePerformanceIndex: number; // SPI = EV / PV
  estimateAtCompletion: number; // EAC = BAC / CPI
  estimateToComplete: number; // ETC = EAC - AC
  varianceAtCompletion: number; // VAC = BAC - EAC
  healthStatus: 'on_track' | 'at_risk' | 'critical';
};

export type ResourceWorkloadSummary = {
  userId: string;
  userName: string;
  userRole: string;
  totalAssignedTasks: number;
  completedTasks: number;
  totalEstimatedHours: number;
  totalLoggedHours: number;
  utilizationPercentage: number;
  overloaded: boolean;
};

export type ProjectVelocityForecast = {
  projectId: string;
  currentVelocityTasksPerWeek: number;
  remainingTasksCount: number;
  estimatedWeeksToCompletion: number;
  projectedCompletionDate: string;
  confidenceScore: number;
};

export class EnterpriseAnalyticsEngine {
  public calculateEVM(project: Project, tasks: Task[], timesheets: TimesheetEntry[]): EarnedValueMetrics {
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    const projectTimesheets = timesheets.filter((ts) => ts.projectId === project.id);

    const budgetAtCompletion = project.budgetHours || projectTasks.reduce((sum, t) => sum + (t.estimatedHours || 8), 0);
    const totalTasks = projectTasks.length;
    const completedTasks = projectTasks.filter((t) => t.column.toLowerCase() === 'done').length;

    const completionRatio = totalTasks > 0 ? completedTasks / totalTasks : 0;
    const earnedValue = Math.round(budgetAtCompletion * completionRatio * 10) / 10;

    // Planned Value calculation based on elapsed time vs total target duration
    const startDateMs = new Date(project.startDate).getTime();
    const targetDateMs = new Date(project.targetDate).getTime();
    const nowMs = Date.now();

    let plannedRatio = 0.5; // fallback
    if (targetDateMs > startDateMs) {
      const totalDuration = targetDateMs - startDateMs;
      const elapsed = Math.max(0, Math.min(totalDuration, nowMs - startDateMs));
      plannedRatio = elapsed / totalDuration;
    }
    const plannedValue = Math.round(budgetAtCompletion * plannedRatio * 10) / 10;

    // Actual Cost calculation from timesheets + logged task hours
    const timesheetHours = projectTimesheets.reduce((sum, ts) => sum + ts.hours, 0);
    const taskActualHours = projectTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
    const actualCost = Math.max(timesheetHours, taskActualHours);

    const costVariance = Math.round((earnedValue - actualCost) * 10) / 10;
    const scheduleVariance = Math.round((earnedValue - plannedValue) * 10) / 10;

    const cpi = actualCost > 0 ? Math.round((earnedValue / actualCost) * 100) / 100 : 1.0;
    const spi = plannedValue > 0 ? Math.round((earnedValue / plannedValue) * 100) / 100 : 1.0;

    const estimateAtCompletion = cpi > 0 ? Math.round((budgetAtCompletion / cpi) * 10) / 10 : budgetAtCompletion;
    const estimateToComplete = Math.max(0, Math.round((estimateAtCompletion - actualCost) * 10) / 10);
    const varianceAtCompletion = Math.round((budgetAtCompletion - estimateAtCompletion) * 10) / 10;

    let healthStatus: 'on_track' | 'at_risk' | 'critical' = 'on_track';
    if (cpi < 0.8 || spi < 0.8 || project.riskScore > 65) {
      healthStatus = 'critical';
    } else if (cpi < 0.95 || spi < 0.95 || project.riskScore > 35) {
      healthStatus = 'at_risk';
    }

    return {
      projectId: project.id,
      projectName: project.name,
      plannedValue,
      earnedValue,
      actualCost,
      costVariance,
      scheduleVariance,
      costPerformanceIndex: cpi,
      schedulePerformanceIndex: spi,
      estimateAtCompletion,
      estimateToComplete,
      varianceAtCompletion,
      healthStatus,
    };
  }

  public calculateResourceWorkload(users: User[], tasks: Task[], timesheets: TimesheetEntry[]): ResourceWorkloadSummary[] {
    return users.map((u) => {
      const userTasks = tasks.filter((t) => t.assigneeId === u.id || t.assignee === u.name);
      const userTimesheets = timesheets.filter((ts) => ts.userId === u.id);

      const totalAssignedTasks = userTasks.length;
      const completedTasks = userTasks.filter((t) => t.column.toLowerCase() === 'done').length;
      const totalEstimatedHours = userTasks.reduce((sum, t) => sum + (t.estimatedHours || 8), 0);
      const totalLoggedHours = userTimesheets.reduce((sum, ts) => sum + ts.hours, 0);

      // Standard capacity: 40 hours per week
      const capacityBase = 40;
      const activeUnfinishedHours = userTasks
        .filter((t) => t.column.toLowerCase() !== 'done')
        .reduce((sum, t) => sum + Math.max(0, (t.estimatedHours || 8) - (t.actualHours || 0)), 0);

      const utilizationPercentage = Math.min(200, Math.round((activeUnfinishedHours / capacityBase) * 100));
      const overloaded = activeUnfinishedHours > 45 || userTasks.filter((t) => t.column.toLowerCase() === 'in progress').length > 4;

      return {
        userId: u.id,
        userName: u.name,
        userRole: u.role,
        totalAssignedTasks,
        completedTasks,
        totalEstimatedHours,
        totalLoggedHours,
        utilizationPercentage,
        overloaded,
      };
    });
  }

  public forecastVelocity(project: Project, tasks: Task[]): ProjectVelocityForecast {
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    const completedTasks = projectTasks.filter((t) => t.column.toLowerCase() === 'done');
    const remainingTasks = projectTasks.filter((t) => t.column.toLowerCase() !== 'done');

    const startDateMs = new Date(project.startDate).getTime();
    const elapsedWeeks = Math.max(1, (Date.now() - startDateMs) / (1000 * 3600 * 24 * 7));

    const currentVelocityTasksPerWeek = Math.max(0.5, Math.round((completedTasks.length / elapsedWeeks) * 10) / 10);
    const remainingTasksCount = remainingTasks.length;

    const estimatedWeeksToCompletion = Math.ceil(remainingTasksCount / currentVelocityTasksPerWeek);
    const projectedCompletionMs = Date.now() + estimatedWeeksToCompletion * 7 * 24 * 3600 * 1000;

    let confidenceScore = 85;
    if (project.riskScore > 60) confidenceScore -= 25;
    if (remainingTasks.some((t) => t.riskLevel === 'high')) confidenceScore -= 15;
    confidenceScore = Math.max(30, confidenceScore);

    return {
      projectId: project.id,
      currentVelocityTasksPerWeek,
      remainingTasksCount,
      estimatedWeeksToCompletion,
      projectedCompletionDate: new Date(projectedCompletionMs).toISOString().split('T')[0],
      confidenceScore,
    };
  }
}

export const globalAnalyticsEngine = new EnterpriseAnalyticsEngine();

// Earned Value Management (EVM) and resource workload calculation engine
