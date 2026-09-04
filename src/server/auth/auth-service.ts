import { randomBytes } from 'node:crypto';
import type { EnterpriseStore } from '../store/file-store.js';
import type { SafeUser, User } from '../types.js';
import { verifyPassword } from './crypto.js';

export type Session = {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
};

export class AuthService {
  private sessions = new Map<string, Session>();
  private readonly sessionDurationMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Periodically clean expired sessions every 15 minutes
    setInterval(() => {
      this.cleanExpiredSessions();
    }, 15 * 60 * 1000).unref();
  }

  private cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(token);
      }
    }
  }

  public login(
    emailOrId: string,
    password: string,
    store: EnterpriseStore,
  ): { user: SafeUser; token: string } {
    const user = store.getUserWithAuth(emailOrId);
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (user.status === 'inactive') {
      throw new Error('Account is inactive. Please contact your system administrator.');
    }

    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    // Generate secure session token
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    this.sessions.set(token, {
      token,
      userId: user.id,
      createdAt: now,
      expiresAt: now + this.sessionDurationMs,
    });

    // Update last active
    store.updateUser(user.id, { lastActive: new Date().toISOString() });

    // Log login activity
    store.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'login',
      targetType: 'auth',
      details: `${user.name} logged into the system.`,
    });

    const { passwordHash, salt, ...safeUser } = user;
    return { user: safeUser, token };
  }

  public getSessionUser(
    token: string | undefined,
    store: EnterpriseStore,
  ): SafeUser | undefined {
    if (!token) return undefined;
    const session = this.sessions.get(token);
    if (!session) return undefined;

    if (session.expiresAt < Date.now()) {
      this.sessions.delete(token);
      return undefined;
    }

    return store.getUser(session.userId);
  }

  public logout(token: string, store: EnterpriseStore): void {
    const session = this.sessions.get(token);
    if (session) {
      const user = store.getUser(session.userId);
      if (user) {
        store.logActivity({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: 'logout',
          targetType: 'auth',
          details: `${user.name} logged out.`,
        });
      }
      this.sessions.delete(token);
    }
  }
}

export const globalAuthService = new AuthService();
