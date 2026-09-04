import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnterpriseStore } from './store/file-store.js';
import type { BoardEvent } from './types.js';

function createTestStore() {
  const dir = mkdtempSync(join(tmpdir(), 'kanbrawl-enterprise-test-'));
  const store = new EnterpriseStore(dir);
  return { store, dir };
}

describe('EnterpriseStore', () => {
  let store: EnterpriseStore;
  let dir: string;

  beforeEach(() => {
    ({ store, dir } = createTestStore());
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('File-Based JSON Persistence & Seed Data', () => {
    it('initializes data directory with JSON files on first run', () => {
      expect(existsSync(join(dir, 'users.json'))).toBe(true);
      expect(existsSync(join(dir, 'projects.json'))).toBe(true);
      expect(existsSync(join(dir, 'tasks.json'))).toBe(true);
      expect(existsSync(join(dir, 'teams.json'))).toBe(true);
      expect(existsSync(join(dir, 'columns.json'))).toBe(true);
      expect(existsSync(join(dir, 'timesheets.json'))).toBe(true);
      expect(existsSync(join(dir, 'activities.json'))).toBe(true);
      expect(existsSync(join(dir, 'notifications.json'))).toBe(true);
      expect(existsSync(join(dir, 'settings.json'))).toBe(true);
    });

    it('populates realistic demo projects and users', () => {
      const projects = store.getProjects();
      expect(projects.length).toBeGreaterThanOrEqual(4);
      expect(projects.some((p) => p.key === 'ECOM')).toBe(true);
      expect(projects.some((p) => p.key === 'HOSP')).toBe(true);

      const users = store.getUsers();
      expect(users.length).toBeGreaterThanOrEqual(6);
      expect(users.some((u) => u.email === 'orgadmin@enterprise.com')).toBe(true);
      expect(users.some((u) => u.email === 'pm@enterprise.com')).toBe(true);
    });

    it('returns default enterprise 6-column pipeline', () => {
      const columns = store.getColumnNames();
      expect(columns).toEqual(['Backlog', 'To Do', 'In Progress', 'Blocked', 'Review', 'Done']);
    });
  });

  describe('Task Operations', () => {
    it('creates and persists a new task', () => {
      const task = store.createTask({
        title: 'Audit Payment Gateway',
        description: 'Run automated end-to-end webhook verification',
        column: 'In Progress',
        priority: 'P0',
        assignee: 'David Chen',
        estimatedHours: 12,
        tags: ['Security', 'Payments'],
      });

      expect(task.title).toBe('Audit Payment Gateway');
      expect(task.column).toBe('In Progress');
      expect(task.priority).toBe('P0');
      expect(task.estimatedHours).toBe(12);

      // Verify persistence in tasks.json
      const raw = readFileSync(join(dir, 'tasks.json'), 'utf8');
      const persistedTasks = JSON.parse(raw);
      expect(persistedTasks.some((t: { id: string }) => t.id === task.id)).toBe(true);
    });

    it('moves task to target column and updates timestamp', () => {
      const task = store.createTask({
        title: 'Move Test',
        column: 'To Do',
      });

      const moved = store.moveTask(task.id, 'Review');
      expect(moved.column).toBe('Review');

      const refetched = store.getTask(task.id);
      expect(refetched?.column).toBe('Review');
    });

    it('updates task details and logs changes', () => {
      const task = store.createTask({
        title: 'Initial Title',
        priority: 'P2',
      });

      const updated = store.updateTask(task.id, {
        title: 'Updated Title',
        priority: 'P0',
        actualHours: 6,
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('P0');
      expect(updated.actualHours).toBe(6);
    });

    it('deletes task from store and file', () => {
      const task = store.createTask({
        title: 'To Delete',
      });

      expect(store.getTask(task.id)).toBeDefined();
      store.deleteTask(task.id);
      expect(store.getTask(task.id)).toBeUndefined();
    });
  });

  describe('Project Operations', () => {
    it('creates project and assigns key', () => {
      const project = store.createProject({
        name: 'AI Robotics Platform',
        key: 'ROBOT',
        description: 'Autonomous warehouse automation pipeline',
        budgetHours: 500,
      });

      expect(project.name).toBe('AI Robotics Platform');
      expect(project.key).toBe('ROBOT');
      expect(project.budgetHours).toBe(500);

      const found = store.getProject(project.id);
      expect(found).toBeDefined();
    });

    it('deletes project and cleans up related tasks', () => {
      const project = store.createProject({
        name: 'Temporary Project',
        key: 'TEMP',
      });

      const task = store.createTask({
        title: 'Temp Task',
        projectId: project.id,
      });

      expect(store.getProject(project.id)).toBeDefined();
      expect(store.getTask(task.id)).toBeDefined();

      store.deleteProject(project.id);

      expect(store.getProject(project.id)).toBeUndefined();
      expect(store.getTask(task.id)).toBeUndefined();
    });
  });

  describe('Timesheet and Labor Logging', () => {
    it('logs labor hours and updates linked task actual hours', () => {
      const task = store.createTask({
        title: 'Performance Benchmark',
        estimatedHours: 20,
        actualHours: 5,
      });

      const entry = store.logTime({
        userId: 'usr-emp-david',
        projectId: task.projectId,
        taskId: task.id,
        date: '2026-09-02',
        hours: 4.5,
        description: 'Ran load tests on gateway',
      });

      expect(entry.hours).toBe(4.5);
      const updatedTask = store.getTask(task.id);
      expect(updatedTask?.actualHours).toBe(9.5);
    });
  });

  describe('Event Emission & Real-Time Listeners', () => {
    it('emits events on task mutation', () => {
      const listener = vi.fn();
      const unsubscribe = store.onChange(listener);

      const task = store.createTask({ title: 'Event Task' });
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'task_created' }),
      );

      store.moveTask(task.id, 'Done');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'task_moved' }),
      );

      unsubscribe();
      store.deleteTask(task.id);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
