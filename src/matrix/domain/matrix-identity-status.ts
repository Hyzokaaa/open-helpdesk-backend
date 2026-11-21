import { MatrixIdentity } from './entities/matrix-identity';

/**
 * none: no Matrix ID (never typed, or disconnected); pending: the code was sent and not typed yet;
 * verified: personal notices go to it.
 */
export type MatrixIdentityStatus = 'none' | 'pending' | 'verified';

/** Leaves the ID being changed to, with its code, as if it had never been typed. */
export function clearMatrixIdentityChange(identity: MatrixIdentity): void {
  identity.pendingMatrixUserId = null;
  identity.pendingBotId = null;
  identity.pendingRoomId = null;
  identity.codeHash = null;
  identity.codeExpiresAt = null;
  identity.codeAttempts = 0;
}

export function matrixIdentityStatus(identity: MatrixIdentity | null): MatrixIdentityStatus {
  if (!identity?.matrixUserId) return 'none';
  return identity.verifiedAt ? 'verified' : 'pending';
}
