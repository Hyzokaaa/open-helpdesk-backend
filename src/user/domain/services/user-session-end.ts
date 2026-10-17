import { EventPublisher } from '../../../shared/domain/event-publisher';
import { SESSIONS_REVOKED_EVENT, SessionsRevokedEvent } from '../../../shared/domain/session-events';
import { UserSessionRepository } from '../repositories/user-session.repository';
import { SessionSecret } from './user-session-secret';

interface EndUserSessionProps {
  refreshToken: string;
  now?: Date;
}

/**
 * Signs a browser out: the session and every one in its family, i.e. all the domains of the
 * installation it was handed over to. Unknown or already-ended tokens are ignored: signing out
 * always succeeds.
 */
export class EndUserSession {
  constructor(
    private readonly sessionRepository: UserSessionRepository,
    private readonly events?: EventPublisher,
  ) {}

  async execute(props: EndUserSessionProps): Promise<void> {
    const hash = SessionSecret.hash(props.refreshToken);
    const session = await this.sessionRepository.findByTokenHash(hash)
      ?? await this.sessionRepository.findByPreviousTokenHash(hash);
    if (!session) return;

    await this.sessionRepository.revokeFamily(session.getRootId(), props.now ?? new Date());
    this.events?.emit(SESSIONS_REVOKED_EVENT, { userId: session.userId } satisfies SessionsRevokedEvent);
  }
}
