import { InvalidCredentialsError } from '../../../shared/domain/errors';
import { UserRepository } from '../repositories/user.repository';
import { UserSessionRepository } from '../repositories/user-session.repository';
import { UserSession } from '../entities/user-session';
import { SessionSecret } from './user-session-secret';
import { SignAccessToken } from './user-session-sign-access-token';
import { SessionPolicy } from './user-session-start';

export interface RefreshedSessionTokens {
  accessToken: string;
  /** Null when the token had just been rotated by someone else: the client keeps the one it has. */
  refreshToken: string | null;
}

interface RefreshUserSessionProps {
  refreshToken: string;
  now?: Date;
}

/**
 * Trades a refresh token for a new access token and rotates it. Presenting a token that was
 * already rotated means it was copied: within the grace window it is two tabs racing and gets
 * an access token only; after it, the session is revoked.
 */
export class RefreshUserSession {
  constructor(
    private readonly sessionRepository: UserSessionRepository,
    private readonly userRepository: UserRepository,
    private readonly signAccessToken: SignAccessToken,
    private readonly policy: SessionPolicy,
  ) {}

  async execute(props: RefreshUserSessionProps): Promise<RefreshedSessionTokens> {
    const now = props.now ?? new Date();
    const hash = SessionSecret.hash(props.refreshToken);

    const current = await this.sessionRepository.findByTokenHash(hash);
    if (current) {
      this.ensureUsable(current, now);
      const secret = SessionSecret.generate();
      const rotated = await this.sessionRepository.rotate(current.getId(), hash, {
        tokenHash: secret.hash,
        rotatedAt: now,
        expiresAt: current.rememberMe
          ? new Date(now.getTime() + this.policy.rememberedSessionTtlMs)
          : current.expiresAt,
      });
      // Losing the race means another request rotated this very token an instant ago
      return { accessToken: await this.sign(current), refreshToken: rotated ? secret.raw : null };
    }

    const rotated = await this.sessionRepository.findByPreviousTokenHash(hash);
    if (!rotated) throw new InvalidCredentialsError('Invalid session');

    const withinGrace = rotated.rotatedAt !== null
      && now.getTime() - rotated.rotatedAt.getTime() <= this.policy.rotationGraceMs;
    if (!withinGrace) {
      rotated.revokedAt = now;
      await this.sessionRepository.update(rotated);
      throw new InvalidCredentialsError('Invalid session');
    }

    this.ensureUsable(rotated, now);
    return { accessToken: await this.sign(rotated), refreshToken: null };
  }

  private ensureUsable(session: UserSession, now: Date): void {
    if (session.revokedAt || session.expiresAt.getTime() <= now.getTime()) {
      throw new InvalidCredentialsError('Invalid session');
    }
  }

  private async sign(session: UserSession): Promise<string> {
    const user = await this.userRepository.findById(session.userId);
    if (!user || !user.isActive) throw new InvalidCredentialsError('Invalid session');
    return this.signAccessToken.execute({ user, sessionId: session.getId() });
  }
}
