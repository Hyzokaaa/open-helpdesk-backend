import { UserSession } from '../entities/user-session';

export interface SessionRotation {
  tokenHash: string;
  rotatedAt: Date;
  expiresAt: Date;
}

export interface UserSessionRepository {
  create(session: UserSession): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<UserSession | null>;
  findByPreviousTokenHash(tokenHash: string): Promise<UserSession | null>;
  update(session: UserSession): Promise<void>;
  /**
   * Swaps the refresh token only if it is still `expectedTokenHash`, atomically, so two
   * refreshes racing on the same token cannot both rotate it. False when another one won.
   */
  rotate(sessionId: string, expectedTokenHash: string, rotation: SessionRotation): Promise<boolean>;
  /** Revokes every live session of the user, except `exceptId` when given. */
  revokeAllForUser(userId: string, revokedAt: Date, exceptId?: string): Promise<void>;
  /** Deletes sessions that expired or were revoked before `before`. Returns how many. */
  deleteStale(before: Date): Promise<number>;
}
