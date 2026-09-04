import type { User, Team, Task, Project, UserRole } from '../types.js';

export type SkillCategory = 'frontend' | 'backend' | 'devops' | 'mobile' | 'security' | 'ml_analytics' | 'qa_testing';

export type UserSkillProfile = {
  userId: string;
  userName: string;
  primaryCategory: SkillCategory;
  skills: { skillName: string; proficiencyLevel: 1 | 2 | 3 | 4 | 5 }[];
  weeklyCapacityHours: number;
};

export type AllocationRecommendation = {
  taskId: string;
  taskTitle: string;
  recommendedAssigneeId: string;
  recommendedAssigneeName: string;
  matchScore: number; // 0-100
  reasoning: string;
};

export class ResourcePlannerService {
  private userSkillProfiles: Map<string, UserSkillProfile> = new Map();

  constructor() {
    this.initializeDefaultSkills();
  }

  private initializeDefaultSkills(): void {
    const defaultProfiles: UserSkillProfile[] = [
      {
        userId: 'usr-org-admin',
        userName: 'Eleanor Sterling',
        primaryCategory: 'security',
        skills: [
          { skillName: 'Security Architecture', proficiencyLevel: 5 },
          { skillName: 'Cloud Infrastructure', proficiencyLevel: 5 },
          { skillName: 'System Governance', proficiencyLevel: 5 },
        ],
        weeklyCapacityHours: 40,
      },
      {
        userId: 'usr-pm-marcus',
        userName: 'Marcus Holloway',
        primaryCategory: 'devops',
        skills: [
          { skillName: 'Agile Project Delivery', proficiencyLevel: 5 },
          { skillName: 'Resource Scheduling', proficiencyLevel: 5 },
          { skillName: 'Sprint Facilitation', proficiencyLevel: 4 },
        ],
        weeklyCapacityHours: 40,
      },
      {
        userId: 'usr-lead-sarah',
        userName: 'Sarah Jenkins',
        primaryCategory: 'backend',
        skills: [
          { skillName: 'Node.js & Express', proficiencyLevel: 5 },
          { skillName: 'Distributed Systems & Redis', proficiencyLevel: 5 },
          { skillName: 'TypeScript Microservices', proficiencyLevel: 5 },
        ],
        weeklyCapacityHours: 40,
      },
      {
        userId: 'usr-emp-david',
        userName: 'David Chen',
        primaryCategory: 'frontend',
        skills: [
          { skillName: 'Lit & Web Components', proficiencyLevel: 5 },
          { skillName: 'Payment Gateways & Stripe', proficiencyLevel: 4 },
          { skillName: 'CSS Design Systems', proficiencyLevel: 4 },
        ],
        weeklyCapacityHours: 40,
      },
      {
        userId: 'usr-dev-priya',
        userName: 'Priya Sharma',
        primaryCategory: 'ml_analytics',
        skills: [
          { skillName: 'HL7 FHIR & Healthcare Pipelines', proficiencyLevel: 5 },
          { skillName: 'ML Heuristics & Risk Modeling', proficiencyLevel: 5 },
          { skillName: 'Data Engineering', proficiencyLevel: 4 },
        ],
        weeklyCapacityHours: 40,
      },
    ];

    for (const p of defaultProfiles) {
      this.userSkillProfiles.set(p.userId, p);
    }
  }

  public getSkillProfile(userId: string): UserSkillProfile | undefined {
    return this.userSkillProfiles.get(userId);
  }

  public recommendTaskAssignments(unassignedTasks: Task[], users: User[]): AllocationRecommendation[] {
    const recommendations: AllocationRecommendation[] = [];

    for (const task of unassignedTasks) {
      let bestUser: User | null = null;
      let bestScore = -1;
      let bestReason = 'Best available workload balance.';

      for (const u of users) {
        if (u.role === 'viewer') continue;

        let score = 50;
        const profile = this.userSkillProfiles.get(u.id);

        if (profile) {
          const titleLower = task.title.toLowerCase();
          const descLower = (task.description || '').toLowerCase();

          for (const s of profile.skills) {
            if (titleLower.includes(s.skillName.toLowerCase()) || descLower.includes(s.skillName.toLowerCase())) {
              score += s.proficiencyLevel * 10;
            }
          }

          if (profile.primaryCategory === 'backend' && (titleLower.includes('api') || titleLower.includes('redis'))) {
            score += 20;
          } else if (profile.primaryCategory === 'frontend' && (titleLower.includes('ui') || titleLower.includes('checkout'))) {
            score += 20;
          } else if (profile.primaryCategory === 'security' && (titleLower.includes('auth') || titleLower.includes('encrypt'))) {
            score += 20;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestUser = u;
          bestReason = `Matched skill profile for ${profile?.primaryCategory || u.role} domain. Score: ${score}/100.`;
        }
      }

      if (bestUser) {
        recommendations.push({
          taskId: task.id,
          taskTitle: task.title,
          recommendedAssigneeId: bestUser.id,
          recommendedAssigneeName: bestUser.name,
          matchScore: Math.min(98, bestScore),
          reasoning: bestReason,
        });
      }
    }

    return recommendations;
  }

  public calculateTeamCapacityMatrix(team: Team, users: User[], tasks: Task[]): {
    teamId: string;
    teamName: string;
    totalMemberCount: number;
    availableCapacityHours: number;
    allocatedHours: number;
    capacityDeficitHours: number;
    healthIndex: number;
  } {
    const memberUsers = users.filter((u) => (team.memberIds || []).includes(u.id));
    const totalMemberCount = memberUsers.length;
    const availableCapacityHours = totalMemberCount * 40;

    const teamTasks = tasks.filter((t) => (team.memberIds || []).includes(t.assigneeId || ''));
    const allocatedHours = teamTasks
      .filter((t) => t.column.toLowerCase() !== 'done')
      .reduce((sum, t) => sum + (t.estimatedHours || 8), 0);

    const capacityDeficitHours = Math.max(0, allocatedHours - availableCapacityHours);
    const healthIndex = availableCapacityHours > 0 ? Math.min(100, Math.round(((availableCapacityHours - capacityDeficitHours) / availableCapacityHours) * 100)) : 100;

    return {
      teamId: team.id,
      teamName: team.name,
      totalMemberCount,
      availableCapacityHours,
      allocatedHours,
      capacityDeficitHours,
      healthIndex,
    };
  }
}

export const globalResourcePlanner = new ResourcePlannerService();
