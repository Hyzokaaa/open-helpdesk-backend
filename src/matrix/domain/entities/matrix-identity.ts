import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  userId: string;
  /**
   * The user's Matrix ID, e.g. @ana:example.org. Null once they disconnect it: the row stays, so the
   * code limits below are not reset by disconnecting and connecting again.
   */
  matrixUserId: string | null;
  /** When the user typed the code the bot sent them; null while it is pending. */
  verifiedAt: Date | null;
  /** The pending code, hashed (see matrix-verification-code); null once used or never sent. */
  codeHash: string | null;
  codeExpiresAt: Date | null;
  /** Wrong codes typed for the pending code. */
  codeAttempts: number;
  /** When the last code was sent, to space them out. */
  codeSentAt: Date | null;
  /** Codes sent since sendWindowStartedAt, to cap them per day. */
  codeSends: number;
  sendWindowStartedAt: Date | null;
  /**
   * A new Matrix ID the user is changing to, while the verified one above still gets the notices:
   * it replaces it only once its code is typed. The bot that sent that code, and the chat it sent it
   * in, which becomes that bot's direct chat with the user.
   */
  pendingMatrixUserId?: string | null;
  pendingBotId?: string | null;
  pendingRoomId?: string | null;
}

/** A helpdesk user's own Matrix account, which their personal notices are sent to once verified. */
export class MatrixIdentity {
  readonly id: Id;
  userId: string;
  matrixUserId: string | null;
  verifiedAt: Date | null;
  codeHash: string | null;
  codeExpiresAt: Date | null;
  codeAttempts: number;
  codeSentAt: Date | null;
  codeSends: number;
  sendWindowStartedAt: Date | null;
  pendingMatrixUserId: string | null;
  pendingBotId: string | null;
  pendingRoomId: string | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.userId = props.userId;
    this.matrixUserId = props.matrixUserId;
    this.verifiedAt = props.verifiedAt;
    this.codeHash = props.codeHash;
    this.codeExpiresAt = props.codeExpiresAt;
    this.codeAttempts = props.codeAttempts;
    this.codeSentAt = props.codeSentAt;
    this.codeSends = props.codeSends;
    this.sendWindowStartedAt = props.sendWindowStartedAt;
    this.pendingMatrixUserId = props.pendingMatrixUserId ?? null;
    this.pendingBotId = props.pendingBotId ?? null;
    this.pendingRoomId = props.pendingRoomId ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
