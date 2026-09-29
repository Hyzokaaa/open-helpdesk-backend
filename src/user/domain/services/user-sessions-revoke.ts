import { UserSessionRepository } from '../repositories/user-session.repository';

interface RevokeUserSessionsProps {
  userId: string;
  /** The session to keep, typically the one making the request. */
  exceptSessionId?: string;
  now?: Date;
}

/**
 * Signs a user out everywhere, e.g. after a password change. Access tokens already issued stay
 * valid until they expire, which the short access-token lifetime keeps to minutes.
 */
export class RevokeUserSessions {
  constructor(private readonly sessionRepository: UserSessionRepository) {}

  async execute(props: RevokeUserSessionsProps): Promise<void> {
    await this.sessionRepository.revokeAllForUser(props.userId, props.now ?? new Date(), props.exceptSessionId);
  }
}
