import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  userId: string;
  rootSessionId?: string | null;
  tokenHash: string;
  previousTokenHash?: string | null;
  rotatedAt?: Date | null;
  rememberMe: boolean;
  expiresAt: Date;
  createdAt?: Date | null;
  revokedAt?: Date | null;
}

/**
 * One signed-in device. It holds the hash of its current refresh token, which rotates on every
 * use; the previous hash is kept briefly so two tabs refreshing at once do not look like reuse.
 *
 * A session handed over to another domain of the installation (see ExchangeSessionHandoff) points
 * to the one the user signed in with: they form one family that expires and ends together.
 */
export class UserSession {
  readonly id: Id;
  userId: string;
  rootSessionId: string | null;
  tokenHash: string;
  previousTokenHash: string | null;
  rotatedAt: Date | null;
  rememberMe: boolean;
  expiresAt: Date;
  createdAt: Date | null;
  revokedAt: Date | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.userId = props.userId;
    this.rootSessionId = props.rootSessionId ?? null;
    this.tokenHash = props.tokenHash;
    this.previousTokenHash = props.previousTokenHash ?? null;
    this.rotatedAt = props.rotatedAt ?? null;
    this.rememberMe = props.rememberMe;
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt ?? null;
    this.revokedAt = props.revokedAt ?? null;
  }

  getId(): string {
    return this.id.get();
  }

  /** The session the user signed in with: itself, or the one it was handed over from. */
  getRootId(): string {
    return this.rootSessionId ?? this.getId();
  }
}
