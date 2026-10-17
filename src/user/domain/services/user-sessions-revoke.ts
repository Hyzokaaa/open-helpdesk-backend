import { EventPublisher } from '../../../shared/domain/event-publisher';
import { SESSIONS_REVOKED_EVENT, SessionsRevokedEvent } from '../../../shared/domain/session-events';
import { UserSessionRepository } from '../repositories/user-session.repository';

interface RevokeUserSessionsProps {
  userId: string;
  /** The session to keep, typically the one making the request. */
  exceptSessionId?: string;
  now?: Date;
}

/**
 * Signs a user out everywhere, e.g. after a password change. Takes effect at once: every request
 * checks its session, and open sockets are told to close.
 */
export class RevokeUserSessions {
  constructor(
    private readonly sessionRepository: UserSessionRepository,
    private readonly events?: EventPublisher,
  ) {}

  async execute(props: RevokeUserSessionsProps): Promise<void> {
    await this.sessionRepository.revokeAllForUser(props.userId, props.now ?? new Date(), props.exceptSessionId);
    this.events?.emit(SESSIONS_REVOKED_EVENT, { userId: props.userId } satisfies SessionsRevokedEvent);
  }
}
