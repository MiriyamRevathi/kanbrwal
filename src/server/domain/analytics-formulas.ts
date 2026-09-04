export type RiskWeightMatrix = {
  overdueTaskWeight: number;
  blockedTaskWeight: number;
  p0UnfinishedWeight: number;
  unassignedTaskWeight: number;
  hoursVarianceWeight: number;
  deadlinePressureWeight: number;
};

export const DEFAULT_RISK_WEIGHTS: RiskWeightMatrix = {
  overdueTaskWeight: 25,
  blockedTaskWeight: 20,
  p0UnfinishedWeight: 20,
  unassignedTaskWeight: 10,
  hoursVarianceWeight: 15,
  deadlinePressureWeight: 10,
};

export function calculateWeightedRiskScore(
  overdueRatio: number,
  blockedRatio: number,
  p0UnfinishedRatio: number,
  unassignedRatio: number,
  hoursVarianceRatio: number,
  deadlinePressureRatio: number,
  weights: RiskWeightMatrix = DEFAULT_RISK_WEIGHTS,
): number {
  const score =
    overdueRatio * weights.overdueTaskWeight +
    blockedRatio * weights.blockedTaskWeight +
    p0UnfinishedRatio * weights.p0UnfinishedWeight +
    unassignedRatio * weights.unassignedTaskWeight +
    hoursVarianceRatio * weights.hoursVarianceWeight +
    deadlinePressureRatio * weights.deadlinePressureWeight;

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function runMonteCarloScheduleSimulation(
  remainingTasksCount: number,
  averageTaskHours: number,
  teamVelocityStdDev = 0.2,
  iterations = 1000,
): {
  p50DaysToCompletion: number;
  p80DaysToCompletion: number;
  p95DaysToCompletion: number;
} {
  const totalEstimatedHours = remainingTasksCount * averageTaskHours;
  const simulatedDays: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Generate pseudo-random normal variation
    const u1 = Math.random();
    const u2 = Math.random();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    const velocityFactor = Math.max(0.5, 1.0 + randStdNormal * teamVelocityStdDev);
    const simulatedHours = totalEstimatedHours / velocityFactor;
    const days = simulatedHours / 8; // 8 hours per day
    simulatedDays.push(days);
  }

  simulatedDays.sort((a, b) => a - b);

  const p50Index = Math.floor(iterations * 0.5);
  const p80Index = Math.floor(iterations * 0.8);
  const p95Index = Math.floor(iterations * 0.95);

  return {
    p50DaysToCompletion: Math.ceil(simulatedDays[p50Index] || 10),
    p80DaysToCompletion: Math.ceil(simulatedDays[p80Index] || 15),
    p95DaysToCompletion: Math.ceil(simulatedDays[p95Index] || 22),
  };
}
