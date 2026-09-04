import { Router } from 'express';
import type { EnterpriseStore } from './store/file-store.js';
import type { Column, Priority, RiskLevel, UserRole, Project, NotificationType, NotificationPriority } from './types.js';
import { AuthService, globalAuthService } from './auth/auth-service.js';
import {
  createAuthMiddleware,
  requireAuth,
  requireRole,
  forbidViewerMutation,
  type AuthenticatedRequest,
} from './auth/middleware.js';
import { MLRiskEngine } from './ml/risk-engine.js';
import { hashPassword } from './auth/crypto.js';

function getParamId(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export function createApiRouter(
  store: EnterpriseStore,
  authService: AuthService = globalAuthService,
): Router {
  // eslint-disable-next-line new-cap
  const router = Router();

  // Attach auth context to all requests
  router.use(createAuthMiddleware(store, authService));

  // ── 1. Authentication Endpoints ──
  router.post('/auth/login', (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const result = authService.login(email.trim(), password, store);

      res.cookie('session_token', result.token, {
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.json(result);
    } catch (error) {
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Authentication failed.',
      });
    }
  });

  router.post('/auth/logout', (req: AuthenticatedRequest, res) => {
    if (req.token) {
      authService.logout(req.token, store);
    }
    res.clearCookie('session_token');
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  router.get('/auth/me', (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated.', code: 'UNAUTHENTICATED' });
      return;
    }
    res.json({ user: req.user });
  });

  // ── 2. Full Board State ──
  router.get('/board', (req: AuthenticatedRequest, res) => {
    const board = store.getBoard();
    const safeUsers = store.getUsers();
    res.json({
      ...board,
      users: safeUsers,
    });
  });

  // ── 3. Projects ──
  router.get('/projects', (req: AuthenticatedRequest, res) => {
    const projects = store.getProjects();
    const tasks = store.getTasks();

    const enriched = projects.map((p) => {
      const assessment = MLRiskEngine.assessProjectRisk(p, tasks);
      return {
        ...p,
        riskLevel: assessment.riskLevel,
        riskScore: assessment.riskScore,
        riskFactors: assessment.riskFactors,
        metrics: assessment.metrics,
      };
    });

    res.json(enriched);
  });

  router.get('/projects/:id', (req: AuthenticatedRequest, res) => {
    const id = getParamId(req.params.id);
    const project = store.getProject(id);
    if (!project) {
      res.status(404).json({ error: `Project "${id}" not found.` });
      return;
    }

    const tasks = store.getTasks({ projectId: project.id });
    const assessment = MLRiskEngine.assessProjectRisk(project, store.getTasks());

    res.json({
      ...project,
      tasks,
      riskAssessment: assessment,
    });
  });

  router.post(
    '/projects',
    requireAuth,
    requireRole(['org_admin', 'project_manager']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const { name, key, description, managerId, teamIds, priority, startDate, targetDate, budgetHours } =
          req.body as Partial<Project>;

        if (!name || name.trim().length === 0) {
          res.status(400).json({ error: 'Project name is required.' });
          return;
        }

        const manager = managerId ? store.getUser(managerId) : undefined;

        const newProject = store.createProject({
          name: name.trim(),
          key: key?.trim(),
          description: description?.trim(),
          managerId,
          managerName: manager?.name ?? req.user?.name ?? 'Unassigned',
          teamIds: teamIds ?? [],
          priority: priority as Priority,
          startDate,
          targetDate,
          budgetHours: Number(budgetHours) || 100,
        });

        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'project_created',
          targetType: 'project',
          targetId: newProject.id,
          targetTitle: newProject.name,
          details: `${req.user!.name} created project "${newProject.name}".`,
        });

        res.status(201).json(newProject);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  router.patch(
    '/projects/:id',
    requireAuth,
    requireRole(['org_admin', 'project_manager']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const id = getParamId(req.params.id);
        const project = store.updateProject(id, req.body);

        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'project_updated',
          targetType: 'project',
          targetId: project.id,
          targetTitle: project.name,
          details: `${req.user!.name} updated project details for "${project.name}".`,
        });

        res.json(project);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ error: message });
      }
    },
  );

  router.delete(
    '/projects/:id',
    requireAuth,
    requireRole(['org_admin']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const id = getParamId(req.params.id);
        const proj = store.getProject(id);
        const title = proj?.name ?? id;
        store.deleteProject(id);

        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'project_deleted',
          targetType: 'project',
          targetId: id,
          targetTitle: title,
          details: `${req.user!.name} deleted project "${title}".`,
        });

        res.status(204).end();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ error: message });
      }
    },
  );

  // ── 4. Tasks ──
  router.get('/tasks', (req: AuthenticatedRequest, res) => {
    const { projectId, column, priority, assignee, search } = req.query as {
      projectId?: string;
      column?: string;
      priority?: Priority;
      assignee?: string;
      search?: string;
    };

    const tasks = store.getTasks({
      projectId,
      column,
      priority,
      assignee,
      search,
    });
    res.json(tasks);
  });

  router.get('/tasks/:id', (req: AuthenticatedRequest, res) => {
    const id = getParamId(req.params.id);
    const task = store.getTask(id);
    if (!task) {
      res.status(404).json({ error: `Task "${id}" not found.` });
      return;
    }
    res.json(task);
  });

  router.post(
    '/tasks',
    requireAuth,
    requireRole(['org_admin', 'project_manager', 'team_lead']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const {
          title,
          description,
          projectId,
          column,
          priority,
          assigneeId,
          dueDate,
          estimatedHours,
          tags,
          dependencies,
          riskLevel,
          riskNotes,
        } = req.body;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          res.status(400).json({ error: 'Task title is required.' });
          return;
        }

        const assigneeUser = assigneeId ? store.getUser(assigneeId) : undefined;

        const task = store.createTask({
          title: title.trim(),
          description: description?.trim(),
          projectId,
          column,
          priority: priority as Priority,
          assigneeId,
          assignee: assigneeUser?.name ?? '',
          reporterId: req.user!.id,
          reporter: req.user!.name,
          dueDate,
          estimatedHours: Number(estimatedHours) || 8,
          tags: Array.isArray(tags) ? tags : [],
          dependencies: Array.isArray(dependencies) ? dependencies : [],
          riskLevel: riskLevel as RiskLevel,
          riskNotes,
        });

        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'task_created',
          targetType: 'task',
          targetId: task.id,
          targetTitle: task.title,
          details: `${req.user!.name} created task "${task.title}".`,
        });

        if (assigneeId && assigneeId !== req.user!.id) {
          store.addNotification({
            userId: assigneeId,
            title: 'New Task Assigned',
            message: `${req.user!.name} assigned you to "${task.title}".`,
            type: 'info',
            link: '/kanban',
          });
        }

        res.status(201).json(task);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  router.patch(
    '/tasks/:id',
    requireAuth,
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const id = getParamId(req.params.id);
        const currentTask = store.getTask(id);
        if (!currentTask) {
          res.status(404).json({ error: `Task "${id}" not found.` });
          return;
        }

        const userRole = req.user!.role;
        const isEmployee = userRole === 'employee';

        if (isEmployee) {
          const allowedFields = ['column', 'actualHours', 'description', 'riskNotes', 'tags'];
          const requestedFields = Object.keys(req.body);
          const hasUnauthorizedFields = requestedFields.some(
            (f) => !allowedFields.includes(f),
          );
          if (hasUnauthorizedFields && currentTask.assigneeId !== req.user!.id) {
            res.status(403).json({
              error: 'Employees may only update status and progress of tasks.',
              code: 'PERMISSION_DENIED',
            });
            return;
          }
        }

        const {
          column,
          title,
          description,
          priority,
          assigneeId,
          dueDate,
          estimatedHours,
          actualHours,
          tags,
          dependencies,
          riskLevel,
          riskNotes,
        } = req.body;

        let updatedTask = currentTask;

        if (column !== undefined && column !== currentTask.column) {
          updatedTask = store.moveTask(id, column);
          store.logActivity({
            userId: req.user!.id,
            userName: req.user!.name,
            userRole: req.user!.role,
            action: 'task_moved',
            targetType: 'task',
            targetId: updatedTask.id,
            targetTitle: updatedTask.title,
            details: `${req.user!.name} moved "${updatedTask.title}" from ${currentTask.column} to ${column}.`,
          });
        }

        const updates: Record<string, unknown> = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (priority !== undefined) updates.priority = priority;
        if (assigneeId !== undefined) {
          updates.assigneeId = assigneeId;
          updates.assignee = store.getUser(assigneeId)?.name ?? '';
        }
        if (dueDate !== undefined) updates.dueDate = dueDate;
        if (estimatedHours !== undefined) updates.estimatedHours = Number(estimatedHours);
        if (actualHours !== undefined) updates.actualHours = Number(actualHours);
        if (tags !== undefined) updates.tags = tags;
        if (dependencies !== undefined) updates.dependencies = dependencies;
        if (riskLevel !== undefined) updates.riskLevel = riskLevel;
        if (riskNotes !== undefined) updates.riskNotes = riskNotes;

        if (Object.keys(updates).length > 0) {
          updatedTask = store.updateTask(id, updates);
          store.logActivity({
            userId: req.user!.id,
            userName: req.user!.name,
            userRole: req.user!.role,
            action: 'task_updated',
            targetType: 'task',
            targetId: updatedTask.id,
            targetTitle: updatedTask.title,
            details: `${req.user!.name} updated task "${updatedTask.title}".`,
          });
        }

        res.json(updatedTask);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ error: message });
      }
    },
  );

  router.delete(
    '/tasks/:id',
    requireAuth,
    requireRole(['org_admin', 'project_manager', 'team_lead']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const id = getParamId(req.params.id);
        const task = store.getTask(id);
        const title = task?.title ?? id;
        store.deleteTask(id);

        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'task_deleted',
          targetType: 'task',
          targetId: id,
          targetTitle: title,
          details: `${req.user!.name} deleted task "${title}".`,
        });

        res.status(204).end();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ error: message });
      }
    },
  );

  // ── 5. Columns ──
  router.get('/columns', (_req, res) => {
    res.json(store.getColumns());
  });

  router.put(
    '/columns',
    requireAuth,
    requireRole(['org_admin', 'project_manager']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const { columns } = req.body as { columns?: Column[] };
        if (!columns || !Array.isArray(columns)) {
          res.status(400).json({ error: 'columns array is required.' });
          return;
        }

        const updated = store.updateColumns(columns);
        res.json({ columns: updated });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // ── 6. Users & Teams ──
  router.get('/users', (_req, res) => {
    res.json(store.getUsers());
  });

  router.post(
    '/users',
    requireAuth,
    requireRole(['org_admin']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const { name, email, password, role, title, teamId } = req.body;
        if (!name || !email || !password || !role) {
          res.status(400).json({ error: 'Name, email, password, and role are required.' });
          return;
        }

        const { hash, salt } = hashPassword(password);
        const newUser = store.createUser({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash: hash,
          salt,
          role: role as UserRole,
          organizationId: req.user!.organizationId,
          teamId,
          status: 'active',
          title: title?.trim() ?? 'Team Member',
          avatarColor: '#2b4c7e',
        });

        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'user_created',
          targetType: 'user',
          targetId: newUser.id,
          targetTitle: newUser.name,
          details: `${req.user!.name} created user account for ${newUser.name} (${newUser.role}).`,
        });

        res.status(201).json(newUser);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  router.patch(
    '/users/:id',
    requireAuth,
    requireRole(['org_admin']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const id = getParamId(req.params.id);
        const { password, ...fields } = req.body;
        if (password) {
          const { hash, salt } = hashPassword(password);
          fields.passwordHash = hash;
          fields.salt = salt;
        }
        const updated = store.updateUser(id, fields);

        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'user_updated',
          targetType: 'user',
          targetId: updated.id,
          targetTitle: updated.name,
          details: `${req.user!.name} updated user profile for ${updated.name}.`,
        });

        res.json(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ error: message });
      }
    },
  );

  router.delete(
    '/users/:id',
    requireAuth,
    requireRole(['org_admin']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const id = getParamId(req.params.id);
        if (id === req.user!.id) {
          res.status(400).json({ error: 'Cannot delete your own account.' });
          return;
        }
        store.deleteUser(id);
        res.status(204).end();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(404).json({ error: message });
      }
    },
  );

  router.get('/teams', (_req, res) => {
    res.json(store.getTeams());
  });

  router.post(
    '/teams',
    requireAuth,
    requireRole(['org_admin']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const { name, leadId, memberIds, description } = req.body;
        if (!name) {
          res.status(400).json({ error: 'Team name is required.' });
          return;
        }
        const team = store.createTeam({
          name: name.trim(),
          leadId,
          memberIds: memberIds ?? [],
          description,
        });

        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'user_created',
          targetType: 'user',
          targetId: team.id,
          targetTitle: team.name,
          details: `${req.user!.name} created team "${team.name}".`,
        });

        // Create notifications for everyone EXCEPT employee and viewer roles
        const eligibleUsers = store.getUsers().filter(
          (u) => u.role !== 'employee' && u.role !== 'viewer',
        );
        for (const targetUser of eligibleUsers) {
          store.addNotification({
            userId: targetUser.id,
            title: 'New Engineering Team Created',
            message: `${req.user!.name} created new team "${team.name}".`,
            type: 'info',
            link: '/teams',
          });
        }

        res.status(201).json(team);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  router.patch(
    '/teams/:id',
    requireAuth,
    requireRole(['org_admin', 'project_manager', 'team_lead']),
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const id = getParamId(req.params.id);
        const { memberIds } = req.body as { memberIds?: string[] };

        // Team leads can only update their own team's members
        const userRole = req.user!.role;
        if (userRole === 'team_lead') {
          const team = store.getTeam(id);
          if (!team) {
            res.status(404).json({ error: `Team "${id}" not found.` });
            return;
          }
          if (team.leadId !== req.user!.id) {
            res.status(403).json({
              error: 'Team Leads may only manage membership of their own team.',
              code: 'PERMISSION_DENIED',
            });
            return;
          }
          // Team leads can only update memberIds
          if (memberIds === undefined) {
            res.status(400).json({ error: 'memberIds is required.' });
            return;
          }
          const updated = store.updateTeam(id, { memberIds });
          res.json(updated);
          return;
        }

        const updated = store.updateTeam(id, req.body);
        res.json(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.includes('not found') ? 404 : 400;
        res.status(status).json({ error: message });
      }
    },
  );

  // ── 7. Timesheets ──
  router.get('/timesheets', (req: AuthenticatedRequest, res) => {
    const { userId, projectId } = req.query as { userId?: string; projectId?: string };
    const list = store.getTimesheets({ userId, projectId });
    res.json(list);
  });

  router.post(
    '/timesheets',
    requireAuth,
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const { projectId, taskId, date, hours, description } = req.body;
        if (!projectId || !hours || !date) {
          res.status(400).json({ error: 'Project, date, and hours are required.' });
          return;
        }

        const entry = store.logTime({
          userId: req.user!.id,
          userName: req.user!.name,
          projectId,
          taskId,
          date,
          hours: Number(hours),
          description: description?.trim() ?? 'Work log',
        });

        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'time_logged',
          targetType: 'timesheet',
          targetId: entry.id,
          targetTitle: entry.projectName,
          details: `${req.user!.name} logged ${entry.hours}h on ${entry.projectName}.`,
        });

        res.status(201).json(entry);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // ── 8. ML Project Risk Engine ──
  router.get('/risk/project/:id', (req, res) => {
    const id = getParamId(req.params.id);
    const project = store.getProject(id);
    if (!project) {
      res.status(404).json({ error: `Project "${id}" not found.` });
      return;
    }
    const assessment = MLRiskEngine.assessProjectRisk(project, store.getTasks());
    res.json(assessment);
  });

  router.get('/risk/overview', (_req, res) => {
    const projects = store.getProjects();
    const tasks = store.getTasks();
    const map = MLRiskEngine.assessAll(projects, tasks);
    res.json(map);
  });

  // ── 9. Audit Logs / Activities ──
  router.get('/activities', (_req, res) => {
    res.json(store.getActivities(100));
  });

  // ── 10. Notifications ──
  router.get('/notifications', (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const list = store.getNotifications(userId, userRole);
    res.json(list);
  });

  router.post(
    '/notifications',
    requireAuth,
    forbidViewerMutation,
    (req: AuthenticatedRequest, res) => {
      try {
        const role = req.user!.role;
        // Strictly allow ONLY org_admin, project_manager, and team_lead
        if (!['org_admin', 'project_manager', 'team_lead'].includes(role)) {
          res.status(403).json({
            error: 'Access denied. Employees and Viewers are not authorized to send manual notifications.',
            code: 'FORBIDDEN',
          });
          return;
        }

        const {
          recipient,
          title,
          message,
          type,
          priority,
          projectId,
          taskId,
        } = req.body as {
          recipient?: string;
          title?: string;
          message?: string;
          type?: NotificationType;
          priority?: NotificationPriority;
          projectId?: string;
          taskId?: string;
        };

        if (!recipient || !title || title.trim().length === 0 || !message || message.trim().length === 0) {
          res.status(400).json({ error: 'Recipient, Title, and Message are required fields.' });
          return;
        }

        const validTypes: NotificationType[] = [
          'info',
          'announcement',
          'task_update',
          'project_update',
          'deadline',
          'risk_alert',
          'urgent',
        ];
        const notifType = validTypes.includes(type as NotificationType)
          ? (type as NotificationType)
          : 'announcement';

        const validPriorities: NotificationPriority[] = ['normal', 'important', 'urgent'];
        const notifPriority = validPriorities.includes(priority as NotificationPriority)
          ? (priority as NotificationPriority)
          : 'normal';

        if (projectId) {
          const proj = store.getProject(projectId);
          if (!proj) {
            res.status(400).json({ error: `Selected project "${projectId}" does not exist.` });
            return;
          }
        }

        if (taskId) {
          const task = store.getTask(taskId);
          if (!task) {
            res.status(400).json({ error: `Selected task "${taskId}" does not exist.` });
            return;
          }
          if (projectId && task.projectId !== projectId) {
            res.status(400).json({
              error: `Task "${taskId}" does not belong to project "${projectId}".`,
            });
            return;
          }
        }

        let userIdTarget = 'all';
        let recipientRoleTarget: UserRole | undefined = undefined;

        if (['org_admin', 'project_manager', 'team_lead', 'employee'].includes(recipient)) {
          recipientRoleTarget = recipient as UserRole;
          userIdTarget = recipient;
        } else if (recipient === 'all') {
          userIdTarget = 'all';
        } else {
          const targetUser = store.getUser(recipient);
          if (!targetUser) {
            res.status(400).json({ error: `Recipient user "${recipient}" not found.` });
            return;
          }
          userIdTarget = targetUser.id;
        }

        const newNotif = store.addNotification({
          userId: userIdTarget,
          senderId: req.user!.id,
          senderName: req.user!.name,
          senderRole: req.user!.role,
          recipientRole: recipientRoleTarget,
          title: title.trim(),
          message: message.trim(),
          type: notifType,
          priority: notifPriority,
          projectId: projectId || undefined,
          taskId: taskId || undefined,
          source: 'manual',
          link: projectId ? `/projects/${projectId}` : undefined,
        });

        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'notification_sent',
          targetType: 'notification',
          targetId: newNotif.id,
          targetTitle: newNotif.title,
          details: `${req.user!.name} (${req.user!.role}) sent manual notification "${newNotif.title}".`,
        });

        res.status(201).json(newNotif);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  router.patch('/notifications/:id/read', (req, res) => {
    const id = getParamId(req.params.id);
    store.markNotificationAsRead(id);
    res.json({ success: true });
  });

  // ── 11. Reports & Data Export ──
  router.get('/reports/summary', (_req, res) => {
    const projects = store.getProjects();
    const tasks = store.getTasks();
    const users = store.getUsers();
    const timesheets = store.getTimesheets();

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.column.toLowerCase() === 'done').length;
    const overdueTasks = tasks.filter((t) => {
      if (!t.dueDate || t.column.toLowerCase() === 'done') return false;
      return new Date(t.dueDate).getTime() < Date.now();
    }).length;

    const totalHoursLogged = timesheets.reduce((sum, ts) => sum + ts.hours, 0);

    const workload = users.map((u) => {
      const userTasks = tasks.filter((t) => t.assigneeId === u.id || t.assignee === u.name);
      const activeTasks = userTasks.filter((t) => t.column.toLowerCase() !== 'done');
      const userHours = timesheets
        .filter((ts) => ts.userId === u.id)
        .reduce((sum, ts) => sum + ts.hours, 0);
      return {
        userId: u.id,
        userName: u.name,
        role: u.role,
        totalTasks: userTasks.length,
        activeTasks: activeTasks.length,
        hoursLogged: userHours,
      };
    });

    const riskAssessments = MLRiskEngine.assessAll(projects, tasks);

    res.json({
      summary: {
        totalProjects: projects.length,
        totalTasks,
        completedTasks,
        completionRate: totalTasks === 0 ? 100 : Math.round((completedTasks / totalTasks) * 100),
        overdueTasks,
        totalHoursLogged,
      },
      workload,
      riskAssessments,
    });
  });

  router.get('/reports/export/:format', (req, res) => {
    const format = getParamId(req.params.format);
    const { entity } = req.query as { entity?: string };

    let data: unknown = [];
    if (entity === 'timesheets') {
      data = store.getTimesheets();
    } else if (entity === 'activities') {
      data = store.getActivities();
    } else if (entity === 'projects') {
      data = store.getProjects();
    } else {
      data = store.getTasks();
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="export-${entity || 'tasks'}-${Date.now()}.json"`,
      );
      res.send(JSON.stringify(data, null, 2));
      return;
    }

    if (format === 'csv') {
      const items = Array.isArray(data) ? data : [];
      if (items.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.send('');
        return;
      }

      const headers = Object.keys(items[0]);
      const csvRows = [
        headers.join(','),
        ...items.map((row) =>
          headers
            .map((h) => {
              const val = row[h];
              const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
              return `"${str.replace(/"/g, '""')}"`;
            })
            .join(','),
        ),
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="export-${entity || 'tasks'}-${Date.now()}.csv"`,
      );
      res.send(csvRows.join('\n'));
      return;
    }

    res.status(400).json({ error: 'Unsupported format. Choose "csv" or "json".' });
  });

  // ── 12. Settings & Demo Reset ──
  router.get('/settings', (_req, res) => {
    res.json(store.getSettings());
  });

  router.put(
    '/settings',
    requireAuth,
    requireRole(['org_admin']),
    (req: AuthenticatedRequest, res) => {
      try {
        const updated = store.updateSettings(req.body);
        store.logActivity({
          userId: req.user!.id,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'settings_updated',
          targetType: 'settings',
          details: `${req.user!.name} updated system settings.`,
        });
        res.json(updated);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  router.post('/dev/reset-seed', (_req, res) => {
    const seed = store.resetToSeed();
    res.json({ success: true, message: 'Data reset to demo seed data.', seed });
  });

  return router;
}
