import { describe, it, expect } from 'vitest';
import { MLRiskEngine } from './ml/risk-engine.js';
import type { Project, Task } from './types.js';

describe('Local ML Project Risk Engine', () => {
  const baseProject: Project = {
    id: 'proj-test',
    name: 'Test Project',
    key: 'TEST',
    description: 'Testing ML Risk Engine',
    organizationId: 'org-test',
    managerId: 'usr-pm',
    managerName: 'Test PM',
    teamIds: [],
    status: 'in_progress',
    priority: 'P0',
    riskLevel: 'low',
    riskScore: 0,
    riskFactors: [],
    startDate: '2026-08-01T00:00:00.000Z',
    targetDate: '2026-09-30T00:00:00.000Z',
    budgetHours: 200,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  it('calculates low risk for on-track completed tasks', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        projectId: 'proj-test',
        title: 'Task 1',
        description: '',
        column: 'Done',
        priority: 'P1',
        estimatedHours: 10,
        actualHours: 8,
        tags: [],
        dependencies: [],
        riskLevel: 'low',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      },
      {
        id: 't2',
        projectId: 'proj-test',
        title: 'Task 2',
        description: '',
        column: 'Done',
        priority: 'P1',
        estimatedHours: 10,
        actualHours: 9,
        tags: [],
        dependencies: [],
        riskLevel: 'low',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-03T00:00:00.000Z',
      },
    ];

    const assessment = MLRiskEngine.assessProjectRisk(baseProject, tasks);
    expect(assessment.riskLevel).toBe('low');
    expect(assessment.riskScore).toBeLessThan(35);
    expect(assessment.metrics.completionPercentage).toBe(100);
  });

  it('elevates risk to HIGH when multiple tasks are overdue and blocked', () => {
    const pastDate = new Date(Date.now() - 5 * 86400000).toISOString();
    const tasks: Task[] = [
      {
        id: 't1',
        projectId: 'proj-test',
        title: 'Overdue Blocker 1',
        description: '',
        column: 'Blocked',
        priority: 'P0',
        dueDate: pastDate,
        estimatedHours: 40,
        actualHours: 60,
        tags: [],
        dependencies: [],
        riskLevel: 'high',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      },
      {
        id: 't2',
        projectId: 'proj-test',
        title: 'Overdue Blocker 2',
        description: '',
        column: 'Blocked',
        priority: 'P0',
        dueDate: pastDate,
        estimatedHours: 30,
        actualHours: 50,
        tags: [],
        dependencies: [],
        riskLevel: 'high',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      },
    ];

    const assessment = MLRiskEngine.assessProjectRisk(baseProject, tasks);
    expect(assessment.riskLevel).toBe('high');
    expect(assessment.riskScore).toBeGreaterThanOrEqual(65);
    expect(assessment.riskFactors.some((f) => f.includes('past deadline'))).toBe(true);
    expect(assessment.riskFactors.some((f) => f.includes('blocked'))).toBe(true);
    expect(assessment.recommendations.length).toBeGreaterThan(0);
  });
});
