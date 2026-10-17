/** Emitted with `{ userId }` after sessions of that user were revoked, so open sockets can be closed. */
export const SESSIONS_REVOKED_EVENT = 'user.sessions-revoked';

export interface SessionsRevokedEvent {
  userId: string;
}
