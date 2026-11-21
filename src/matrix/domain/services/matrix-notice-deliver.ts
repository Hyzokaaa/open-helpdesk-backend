import { IdGenerator } from '../../../shared/domain/id-generator';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixRoom } from '../entities/matrix-room';
import { MatrixTicketThread } from '../entities/matrix-ticket-thread';
import { MatrixApiError, MatrixClient, MatrixMessageContent } from '../matrix-client';
import { matrixFileContent, matrixThreadNoteContent } from '../matrix-notice-content';
import { MatrixNoticeFile } from '../matrix-notice-files';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';
import { MatrixTicketThreadRepository } from '../repositories/matrix-ticket-thread.repository';
import { Sleep, realSleep, withMatrixRetries } from '../matrix-retries';

interface Props {
  room: MatrixRoom;
  bot: MatrixBot;
  /** Builds the message, answering in this thread root when there is one. */
  content: (threadRootEventId: string | null) => MatrixMessageContent;
  /** The same for every attempt of one notice, so a retry never posts it twice. */
  txnId: string;
  /** The ticket the notice is about: its later notices answer in the thread this one opens. */
  ticketId: string | null;
  /** Whether this notice opens the ticket's thread (a new ticket) rather than answer in it. */
  opensThread?: boolean;
}

interface FileProps {
  room: MatrixRoom;
  bot: MatrixBot;
  /** The ticket's thread the file answers in. */
  threadRootEventId: string;
  txnId: string;
  file: MatrixNoticeFile;
  read: () => Promise<Buffer>;
  /** Posted in the thread instead when the file cannot be sent (too large for the server, unreadable). */
  failedText: string;
}

export type MatrixDelivery =
  | { sent: true; eventId: string; threadRootEventId: string }
  | { sent: false; error: string; lostAccess: boolean };

/**
 * Sends one notice to a room: in the ticket's thread when it has one (else it becomes the root),
 * retrying what the server asks to wait for or fails on. When the bot lost access (token revoked,
 * removed from the room) the room is paused, with one audit entry, until a test works again.
 */
export class DeliverMatrixNotice {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly roomRepository: MatrixRoomRepository,
    private readonly threadRepository: MatrixTicketThreadRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly sleep: Sleep = realSleep,
  ) {}

  async execute(props: Props): Promise<MatrixDelivery> {
    const token = this.cipher.decrypt(props.bot.encryptedAccessToken);
    if (!token) return this.fail(props.room, 'The bot\'s saved token can no longer be read: connect the bot again', true);

    const thread = props.ticketId && !props.opensThread ? await this.threadRepository.find(props.ticketId, props.room.roomId) : null;
    const content = props.content(thread?.rootEventId ?? null);

    try {
      const eventId = await this.withRetries(() => this.client.sendMessage(props.bot.homeserverUrl, token, props.room.roomId, props.txnId, content));
      if (props.ticketId && !thread) {
        await this.threadRepository.save(new MatrixTicketThread({ id: this.idGenerator.create(), ticketId: props.ticketId, roomId: props.room.roomId, rootEventId: eventId }));
      }
      if (props.room.lastError) {
        props.room.lastError = null;
        props.room.lastErrorAt = null;
        await this.roomRepository.save(props.room);
      }
      return { sent: true, eventId, threadRootEventId: thread?.rootEventId ?? eventId };
    } catch (error) {
      if (!(error instanceof MatrixApiError)) throw error;
      return this.fail(props.room, error.message, error.lostAccess, error.errcode);
    }
  }

  /**
   * Uploads one file to the homeserver and posts it in the ticket's thread. A file the server
   * refuses or storage cannot read becomes a short note instead; lost access pauses the room.
   */
  async sendFile(props: FileProps): Promise<MatrixDelivery> {
    const token = this.cipher.decrypt(props.bot.encryptedAccessToken);
    if (!token) return this.fail(props.room, 'The bot\'s saved token can no longer be read: connect the bot again', true);
    const { homeserverUrl } = props.bot;
    const roomId = props.room.roomId;

    try {
      const bytes = await props.read().catch(() => null);
      if (!bytes) throw new MatrixApiError(-1, null, `${props.file.name} could not be read from storage`);
      const contentUri = await this.withRetries(() => this.client.uploadMedia(homeserverUrl, token, bytes, props.file.mimeType, props.file.name));
      const eventId = await this.withRetries(() => this.client.sendMessage(homeserverUrl, token, roomId, props.txnId, matrixFileContent(props.file, contentUri, props.threadRootEventId)));
      return { sent: true, eventId, threadRootEventId: props.threadRootEventId };
    } catch (error) {
      if (!(error instanceof MatrixApiError)) throw error;
      if (error.lostAccess) return this.fail(props.room, error.message, true, error.errcode);
      await this.withRetries(() => this.client.sendMessage(homeserverUrl, token, roomId, `${props.txnId}-failed`, matrixThreadNoteContent(props.failedText, props.threadRootEventId)))
        .catch(() => undefined);
      return { sent: false, error: error.message, lostAccess: false };
    }
  }

  private withRetries<T>(call: () => Promise<T>): Promise<T> {
    return withMatrixRetries(call, this.sleep);
  }

  private async fail(room: MatrixRoom, message: string, lostAccess: boolean, errcode: string | null = null): Promise<MatrixDelivery> {
    const wasActive = room.isActive;
    room.lastError = message;
    room.lastErrorAt = new Date();
    if (lostAccess) room.isActive = false;
    await this.roomRepository.save(room);

    if (lostAccess && wasActive) {
      await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
        action: AuditAction.MATRIX_ROOM_PAUSED,
        entityType: 'matrix-room',
        entityId: room.getId(),
        userId: null,
        workspaceId: room.workspaceId,
        metadata: { roomId: room.roomId, error: message, errcode },
        category: AuditCategory.CONFIG,
        level: AuditLevel.WARNING,
        source: 'system',
      });
    }
    return { sent: false, error: message, lostAccess };
  }
}
