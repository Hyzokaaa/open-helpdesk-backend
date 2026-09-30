import { UserSessionRepository } from '../repositories/user-session.repository';
import { SessionSecret } from './user-session-secret';

interface EndUserSessionProps {
  refreshToken: string;
  now?: Date;
}

/** Signs a device out. Unknown or already-ended tokens are ignored: signing out always succeeds. */
export class EndUserSession {
  constructor(private readonly sessionRepository: UserSessionRepository) {}

  async execute(props: EndUserSessionProps): Promise<void> {
    const hash = SessionSecret.hash(props.refreshToken);
    const session = await this.sessionRepository.findByTokenHash(hash)
      ?? await this.sessionRepository.findByPreviousTokenHash(hash);
    if (!session || session.revokedAt) return;

    session.revokedAt = props.now ?? new Date();
    await this.sessionRepository.update(session);
  }
}
