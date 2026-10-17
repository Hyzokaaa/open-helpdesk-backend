import { UserSession } from '../../src/user/domain/entities/user-session';
import { SessionRotation, UserSessionRepository } from '../../src/user/domain/repositories/user-session.repository';

export class MockUserSessionRepository implements UserSessionRepository {
  sessions: UserSession[] = [];

  async create(session: UserSession): Promise<void> {
    this.sessions.push(session);
  }

  async findById(id: string): Promise<UserSession | null> {
    return this.sessions.find((s) => s.getId() === id) ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<UserSession | null> {
    return this.sessions.find((s) => s.tokenHash === tokenHash) ?? null;
  }

  async findByPreviousTokenHash(tokenHash: string): Promise<UserSession | null> {
    return this.sessions.find((s) => s.previousTokenHash === tokenHash) ?? null;
  }

  async update(session: UserSession): Promise<void> {
    const index = this.sessions.findIndex((s) => s.getId() === session.getId());
    if (index >= 0) this.sessions[index] = session;
  }

  async rotate(sessionId: string, expectedTokenHash: string, rotation: SessionRotation): Promise<boolean> {
    const session = this.sessions.find((s) => s.getId() === sessionId);
    if (!session || session.tokenHash !== expectedTokenHash || session.revokedAt) return false;
    session.previousTokenHash = expectedTokenHash;
    session.tokenHash = rotation.tokenHash;
    session.rotatedAt = rotation.rotatedAt;
    session.expiresAt = rotation.expiresAt;
    return true;
  }

  async extendFamily(rootId: string, expiresAt: Date): Promise<void> {
    for (const s of this.family(rootId)) s.expiresAt = expiresAt;
  }

  async revokeFamily(rootId: string, revokedAt: Date): Promise<void> {
    for (const s of this.family(rootId)) s.revokedAt = revokedAt;
  }

  private family(rootId: string): UserSession[] {
    return this.sessions.filter((s) => !s.revokedAt && (s.getId() === rootId || s.rootSessionId === rootId));
  }

  async revokeAllForUser(userId: string, revokedAt: Date, exceptId?: string): Promise<void> {
    for (const s of this.sessions) {
      if (s.userId === userId && !s.revokedAt && s.getId() !== exceptId) s.revokedAt = revokedAt;
    }
  }

  async deleteStale(before: Date): Promise<number> {
    const kept = this.sessions.filter((s) => s.expiresAt.getTime() >= before.getTime()
      && (!s.revokedAt || s.revokedAt.getTime() >= before.getTime()));
    const deleted = this.sessions.length - kept.length;
    this.sessions = kept;
    return deleted;
  }
}
