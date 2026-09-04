import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnterpriseStore } from './store/file-store.js';
import { AuthService } from './auth/auth-service.js';
import { hashPassword, verifyPassword } from './auth/crypto.js';

describe('Auth & Role-Based Access Control', () => {
  let store: EnterpriseStore;
  let authService: AuthService;
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kanbrawl-auth-test-'));
    store = new EnterpriseStore(dir);
    authService = new AuthService();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('Password Hashing', () => {
    it('generates secure hash with salt', () => {
      const result = hashPassword('mysecretpassword');
      expect(result.hash).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(verifyPassword('mysecretpassword', result.hash, result.salt)).toBe(true);
      expect(verifyPassword('wrongpassword', result.hash, result.salt)).toBe(false);
    });
  });

  describe('User Authentication & Sessions', () => {
    it('authenticates Organization Admin with seeded credentials', () => {
      const result = authService.login('orgadmin@enterprise.com', 'admin123', store);
      expect(result.user).toBeDefined();
      expect(result.user.role).toBe('org_admin');
      expect(result.token).toBeDefined();

      const sessionUser = authService.getSessionUser(result.token, store);
      expect(sessionUser?.id).toBe(result.user.id);
    });

    it('authenticates Project Manager with seeded credentials', () => {
      const result = authService.login('pm@enterprise.com', 'pm123', store);
      expect(result.user.role).toBe('project_manager');
    });

    it('authenticates Employee (Dev) with seeded credentials', () => {
      const result = authService.login('employee@enterprise.com', 'emp123', store);
      expect(result.user.role).toBe('employee');
    });

    it('authenticates Viewer with seeded credentials', () => {
      const result = authService.login('viewer@enterprise.com', 'view123', store);
      expect(result.user.role).toBe('viewer');
    });

    it('rejects invalid password', () => {
      expect(() => {
        authService.login('orgadmin@enterprise.com', 'wrongpassword', store);
      }).toThrow(/Invalid email or password/);
    });

    it('rejects unknown user', () => {
      expect(() => {
        authService.login('nonexistent@enterprise.com', 'somepass', store);
      }).toThrow(/Invalid email or password/);
    });

    it('destroys session on logout', () => {
      const { token } = authService.login('orgadmin@enterprise.com', 'admin123', store);
      expect(authService.getSessionUser(token, store)).toBeDefined();

      authService.logout(token, store);
      expect(authService.getSessionUser(token, store)).toBeUndefined();
    });
  });
});
