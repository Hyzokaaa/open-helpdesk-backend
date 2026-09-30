import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  userId: string;
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
 */
export class UserSession {
  readonly id: Id;
  userId: string;
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
}
