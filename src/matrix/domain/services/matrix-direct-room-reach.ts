import { IdGenerator } from '../../../shared/domain/id-generator';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixDirectRoom } from '../entities/matrix-direct-room';
import { MatrixApiError, MatrixClient } from '../matrix-client';
import { Sleep, realSleep, withMatrixRetries } from '../matrix-retries';
import { MatrixDirectRoomRepository } from '../repositories/matrix-direct-room.repository';
import { OpenMatrixDirectRoom } from './matrix-direct-room-open';

/** A user who left the chat, rejected the invitation or was banned from it no longer wants it. */
const GONE = new Set(['leave', 'ban']);

interface Props {
  bot: MatrixBot;
  token: string;
  userId: string;
  matrixUserId: string;
  lang: string | null;
}

/**
 * The user's direct chat with the bot, ready to write in: opened if there is none, and a new one
 * if the bot is no longer in it. Null when the chat is paused, or when the user just left it,
 * which pauses this bot's notices to them until they reconnect it.
 */
export class ReachMatrixDirectRoom {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly directRoomRepository: MatrixDirectRoomRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly openRoom: OpenMatrixDirectRoom,
    private readonly sleep: Sleep = realSleep,
  ) {}

  async execute(props: Props): Promise<MatrixDirectRoom | null> {
    const open = { bot: props.bot, userId: props.userId, matrixUserId: props.matrixUserId, lang: props.lang };
    const room = await this.openRoom.execute(open);
    if (room.lostAt) return null;

    const membership = await this.membership(props.bot, props.token, room, props.matrixUserId);
    if (membership === 'bot-out') {
      // The bot is not in the chat any more (a server admin took it out, or it was replaced without
      // handing it over): a new chat, which the user is invited to
      return this.openRoom.reopen(open);
    }
    if (GONE.has(membership)) {
      await this.lose(room, props.bot, props.matrixUserId, membership);
      return null;
    }
    return room;
  }

  /**
   * The user's membership, or 'bot-out' when the bot cannot read it because it is not in the room.
   * Other refusals (the server's terms not accepted, a limit reached) say nothing about the user and
   * are thrown, so their chat is left as it is.
   */
  private async membership(bot: MatrixBot, token: string, room: MatrixDirectRoom, matrixUserId: string): Promise<string> {
    try {
      return (await withMatrixRetries(() => this.client.membership(bot.homeserverUrl, token, room.roomId, matrixUserId), this.sleep)) ?? 'bot-out';
    } catch (error) {
      if (error instanceof MatrixApiError && (error.status === 404 || (error.status === 403 && error.errcode === 'M_FORBIDDEN'))) return 'bot-out';
      throw error;
    }
  }

  /** Pauses this bot's notices to the user: their profile offers to reconnect the chat. */
  private async lose(room: MatrixDirectRoom, bot: MatrixBot, matrixUserId: string, membership: string): Promise<void> {
    room.lostAt = new Date();
    await this.directRoomRepository.save(room);
    // Nobody to talk to there any more
    const token = this.cipher.decrypt(bot.encryptedAccessToken);
    if (token) await this.client.leaveRoom(bot.homeserverUrl, token, room.roomId).catch(() => undefined);
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.MATRIX_ACCOUNT_LOST,
      entityType: 'matrix-direct-room',
      entityId: room.getId(),
      userId: room.userId,
      workspaceId: null,
      metadata: { matrixUserId, bot: bot.userId, membership },
      category: AuditCategory.USER,
      level: AuditLevel.WARNING,
      source: 'system',
    });
  }
}
