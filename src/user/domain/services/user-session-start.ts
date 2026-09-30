import { IdGenerator } from '../../../shared/domain/id-generator';
import { User } from '../entities/user';
import { UserSession } from '../entities/user-session';
import { UserSessionRepository } from '../repositories/user-session.repository';
import { SessionSecret } from './user-session-secret';
import { SignAccessToken } from './user-session-sign-access-token';

export interface SessionPolicy {
  /** Lifetime of access tokens, in the `expiresIn` format of jsonwebtoken ('15m', '1h'). */
  accessTokenTtl: string;
  /** How long a session lasts when the user did not ask to be remembered. Fixed from sign-in. */
  sessionTtlMs: number;
  /** How long a remembered session lasts; it slides forward on every refresh. */
  rememberedSessionTtlMs: number;
  /** How long a just-rotated refresh token is still accepted, for tabs refreshing at once. */
  rotationGraceMs: number;
}

interface StartUserSessionProps {
  user: User;
  rememberMe: boolean;
  now?: Date;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export class StartUserSession {
  constructor(
    private readonly sessionRepository: UserSessionRepository,
    private readonly idGenerator: IdGenerator,
    private readonly signAccessToken: SignAccessToken,
    private readonly policy: SessionPolicy,
  ) {}

  async execute(props: StartUserSessionProps): Promise<SessionTokens> {
    const now = props.now ?? new Date();
    const ttl = props.rememberMe ? this.policy.rememberedSessionTtlMs : this.policy.sessionTtlMs;
    const secret = SessionSecret.generate();

    const session = new UserSession({
      id: this.idGenerator.create(),
      userId: props.user.getId(),
      tokenHash: secret.hash,
      rememberMe: props.rememberMe,
      expiresAt: new Date(now.getTime() + ttl),
      createdAt: now,
    });
    await this.sessionRepository.create(session);

    const accessToken = await this.signAccessToken.execute({ user: props.user, sessionId: session.getId() });
    return { accessToken, refreshToken: secret.raw };
  }
}
