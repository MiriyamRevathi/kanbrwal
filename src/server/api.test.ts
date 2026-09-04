import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { EnterpriseStore } from './store/file-store.js';
import { AuthService } from './auth/auth-service.js';
import { createApiRouter } from './api.js';

function createTestApp() {
  const dir = mkdtempSync(join(tmpdir(), 'kanbrawl-api-test-'));
  const store = new EnterpriseStore(dir);
  const authService = new AuthService();
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(store, authService));
  return { app, store, authService, dir };
}

describe('REST API Endpoints & RBAC', () => {
  let app: express.Express;
  let store: EnterpriseStore;
  let authService: AuthService;
  let dir: string;

  beforeEach(() => {
    ({ app, store, authService, dir } = createTestApp());
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('Authentication & Session Flow', () => {
    it('POST /api/auth/login logs in valid user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'orgadmin@enterprise.com', password: 'admin123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('orgadmin@enterprise.com');
      expect(res.body.token).toBeDefined();
    });

    it('POST /api/auth/login rejects invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'orgadmin@enterprise.com', password: 'badpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid email or password/i);
    });

    it('GET /api/auth/me returns current user for authenticated request', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pm@enterprise.com', password: 'pm123' });

      const token = loginRes.body.token;

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.role).toBe('project_manager');
    });

    it('GET /api/auth/me returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Project Endpoints & RBAC', () => {
    it('GET /api/projects returns seeded enterprise projects', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
    });

    it('POST /api/projects allows Project Manager to create project', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pm@enterprise.com', password: 'pm123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Cloud Infrastructure Upgrade',
          key: 'CLOUD',
          budgetHours: 350,
        });

      expect(res.status).toBe(201);
      expect(res.body.key).toBe('CLOUD');
    });

    it('POST /api/projects rejects Employee without project management role', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'employee@enterprise.com', password: 'emp123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Unauthorized Project',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Task Endpoints & Movements', () => {
    it('GET /api/tasks returns filtered tasks', async () => {
      const res = await request(app).get('/api/tasks?priority=P0');
      expect(res.status).toBe(200);
      expect(res.body.every((t: { priority: string }) => t.priority === 'P0')).toBe(true);
    });

    it('POST /api/tasks allows Team Lead to create a deliverable', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'lead@enterprise.com', password: 'lead123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Implement OAuth 2.1 Refresh Workflow',
          column: 'In Progress',
          priority: 'P0',
          estimatedHours: 20,
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Implement OAuth 2.1 Refresh Workflow');
    });

    it('PATCH /api/tasks/:id allows moving task between columns', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'employee@enterprise.com', password: 'emp123' });
      const token = loginRes.body.token;

      const task = store.createTask({
        title: 'Move Me',
        column: 'Backlog',
      });

      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ column: 'In Progress' });

      expect(res.status).toBe(200);
      expect(res.body.column).toBe('In Progress');
    });
  });

  describe('Reports and Data Export', () => {
    it('GET /api/reports/summary returns overall metrics and risk breakdown', async () => {
      const res = await request(app).get('/api/reports/summary');
      expect(res.status).toBe(200);
      expect(res.body.summary.totalProjects).toBeGreaterThanOrEqual(4);
      expect(res.body.workload).toBeDefined();
      expect(res.body.riskAssessments).toBeDefined();
    });

    it('GET /api/reports/export/json outputs raw json format', async () => {
      const res = await request(app).get('/api/reports/export/json?entity=tasks');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('GET /api/reports/export/csv outputs csv format', async () => {
      const res = await request(app).get('/api/reports/export/csv?entity=tasks');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });
  });

  describe('Viewer Read-Only Restrictions', () => {
    it('forbids Viewer from creating tasks or mutations (403 Forbidden)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'viewer@enterprise.com', password: 'view123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Viewer Attempt' });

      expect(res.status).toBe(403);
    });
  });

  describe('Manual Send Notification Endpoint & Role Enforcement', () => {
    it('allows Org Admin to send a notification (201 Created)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'orgadmin@enterprise.com', password: 'admin123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipient: 'all',
          title: 'Organization Announcement',
          message: 'All hands meeting scheduled.',
          type: 'announcement',
          priority: 'important',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.source).toBe('manual');
      expect(res.body.senderRole).toBe('org_admin');
    });

    it('allows Project Manager to send a notification (201 Created)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pm@enterprise.com', password: 'pm123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipient: 'team_lead',
          title: 'Sprint Release Notice',
          message: 'Please finalize pull requests by EOD.',
          type: 'project_update',
          priority: 'urgent',
        });

      expect(res.status).toBe(201);
      expect(res.body.senderRole).toBe('project_manager');
    });

    it('allows Team Lead to send a notification (201 Created)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'lead@enterprise.com', password: 'lead123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipient: 'project_manager',
          title: 'Code Freeze Update',
          message: 'Integration tests running cleanly.',
          type: 'info',
        });

      expect(res.status).toBe(201);
      expect(res.body.senderRole).toBe('team_lead');
    });

    it('forbids Employee from sending a notification (403 Forbidden)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'employee@enterprise.com', password: 'emp123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipient: 'all',
          title: 'Employee Broadcast Attempt',
          message: 'Should be blocked.',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Access denied/i);
    });

    it('forbids Viewer from sending a notification (403 Forbidden)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'viewer@enterprise.com', password: 'view123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipient: 'all',
          title: 'Viewer Broadcast Attempt',
          message: 'Should be blocked.',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
    });
  });
});
