import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixDirectRoom } from '../entities/matrix-direct-room';
import { MatrixClient } from '../matrix-client';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixDirectRoomRepository } from '../repositories/matrix-direct-room.repository';

/** Chats left at once: fast with many users, without tripping the server's rate limit. */
const AT_ONCE = 4;

/**
 * Leaves direct chats and forgets them: a user's, on disconnecting or changing the Matrix ID; a
 * bot's, before it is disconnected. Leaving is best effort: the chat is forgotten even if the server
 * does not answer.
 */
export class CloseMatrixDirectRooms {
  constructor(
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly repository: MatrixDirectRoomRepository,
    private readonly botRepository: MatrixBotRepository | null,
  ) {}

  async execute(userId: string): Promise<void> {
    for (const room of await this.repository.findByUserId(userId)) {
      const bot = await this.botRepository?.findById(room.botId);
      if (bot) await this.leave(bot, room);
      else await this.repository.delete(room.getId());
    }
  }

  /** All the chats of a bot, with the token it still has. */
  async ofBot(bot: MatrixBot, token: string | null): Promise<void> {
    const queue = await this.repository.findByBotId(bot.getId());
    const worker = async () => {
      for (let room = queue.shift(); room; room = queue.shift()) {
        if (token) await this.client.leaveRoom(bot.homeserverUrl, token, room.roomId).catch(() => undefined);
        await this.repository.delete(room.getId());
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
  }

  /** A chat that was never saved, such as the one a code for a new Matrix ID went to; best effort. */
  async leaveUnsaved(botId: string, roomId: string): Promise<void> {
    const bot = await this.botRepository?.findById(botId);
    const token = bot ? this.cipher.decrypt(bot.encryptedAccessToken) : null;
    if (bot && token) await this.client.leaveRoom(bot.homeserverUrl, token, roomId).catch(() => undefined);
  }

  /** `forget` false leaves a chat that was never saved. */
  async leave(bot: MatrixBot, room: MatrixDirectRoom, forget = true): Promise<void> {
    const token = this.cipher.decrypt(bot.encryptedAccessToken);
    if (token) await this.client.leaveRoom(bot.homeserverUrl, token, room.roomId).catch(() => undefined);
    if (forget) await this.repository.delete(room.getId());
  }
}
