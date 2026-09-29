import { UserSessionRepository } from '../repositories/user-session.repository';

// Dead sessions are kept a week so a replayed old token is still recognised as reuse
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

interface PurgeStaleSessionsProps {
  now?: Date;
}

/** Deletes sessions that expired or were revoked more than a week ago. Safe to run anywhere, any number of times. */
export class PurgeStaleSessions {
  constructor(private readonly sessionRepository: UserSessionRepository) {}

  async execute(props: PurgeStaleSessionsProps = {}): Promise<number> {
    const now = props.now ?? new Date();
    return this.sessionRepository.deleteStale(new Date(now.getTime() - RETENTION_MS));
  }
}
