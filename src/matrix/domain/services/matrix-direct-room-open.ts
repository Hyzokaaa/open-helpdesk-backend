import { IdGenerator } from '../../../shared/domain/id-generator';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { ConflictError } from '../../../shared/domain/errors';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixDirectRoom } from '../entities/matrix-direct-room';
import { MatrixApiError, MatrixClient } from '../matrix-client';
import { matrixText } from '../matrix-notice-texts';
import { realSleep, withMatrixRetries } from '../matrix-retries';
import { MatrixDirectRoomRepository } from '../repositories/matrix-direct-room.repository';
import { CloseMatrixDirectRooms } from './matrix-direct-rooms-close';

const APP_NAME = process.env.APP_NAME || 'Open Helpdesk';

interface Props {
  bot: MatrixBot;
  userId: string;
  matrixUserId: string;
  lang: string | null;
}

/**
 * The bot's direct chat with a user: the one it has with that Matrix ID (paused or not: the caller
 * decides), or a new one it invites them to.
 */
export class OpenMatrixDirectRoom {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly repository: MatrixDirectRoomRepository,
  ) {}

  async execute(props: Props): Promise<MatrixDirectRoom> {
    const existing = await this.repository.find(props.bot.getId(), props.userId);
    if (existing?.matrixUserId === props.matrixUserId) return existing;
    return this.create(props, existing);
  }

  /** Leaves the chat it has (the user left it, or the bot is no longer in it) and invites them to a new one. */
  async reopen(props: Props): Promise<MatrixDirectRoom> {
    return this.create(props, await this.repository.find(props.bot.getId(), props.userId));
  }

  private async create(props: Props, existing: MatrixDirectRoom | null): Promise<MatrixDirectRoom> {
    const token = this.cipher.decrypt(props.bot.encryptedAccessToken);
    if (!token) throw new MatrixApiError(401, null, 'The bot\'s saved token can no longer be read: connect the bot again');
    const close = new CloseMatrixDirectRooms(this.client, this.cipher, this.repository, null);
    if (existing) await close.leave(props.bot, existing);

    const name = matrixText(props.lang, 'roomName', { app: APP_NAME });
    // Retried only when rate limited: after another failure the room may exist and the user be invited
    const roomId = await withMatrixRetries(() => this.client.createDirectRoom(props.bot.homeserverUrl, token, props.matrixUserId, name), realSleep, true);
    const room = new MatrixDirectRoom({ id: this.idGenerator.create(), botId: props.bot.getId(), userId: props.userId, matrixUserId: props.matrixUserId, roomId, lostAt: null });
    try {
      await this.repository.save(room);
      return room;
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      // Another notice or code opened a chat at the same time: keep that one, leave this one
      await close.leave(props.bot, room, false);
      const other = await this.repository.find(props.bot.getId(), props.userId);
      if (!other) throw error;
      return other;
    }
  }
}
