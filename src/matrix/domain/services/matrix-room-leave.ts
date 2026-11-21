import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { MatrixRoom } from '../entities/matrix-room';
import { MatrixClient } from '../matrix-client';
import { matrixText } from '../matrix-notice-texts';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';
import { ResolveMatrixBot } from './matrix-bot-resolve';

const APP_NAME = process.env.APP_NAME || 'Open Helpdesk';

export interface MatrixRoomLeft {
  left: boolean;
  /** Why the bot stayed in the room. */
  error: string | null;
}

/**
 * The bot says goodbye in a room no longer notified and leaves it, unless the same bot account
 * still writes there for another workspace. The room itself is not touched: its admins decide
 * whether to keep it. Never throws: the room's notices are already stopped.
 */
export class LeaveMatrixRoom {
  constructor(
    private readonly roomRepository: MatrixRoomRepository,
    private readonly botRepository: MatrixBotRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
  ) {}

  async execute(room: MatrixRoom): Promise<MatrixRoomLeft> {
    const resolve = new ResolveMatrixBot(this.botRepository);
    const bot = await resolve.execute(room.workspaceId);
    if (!bot) return { left: false, error: 'No Matrix bot is connected' };
    const token = this.cipher.decrypt(bot.encryptedAccessToken);
    if (!token) return { left: false, error: 'The bot\'s saved token can no longer be read' };

    for (const other of (await this.roomRepository.findByRoomId(room.roomId)).filter((r) => r.getId() !== room.getId())) {
      if ((await resolve.execute(other.workspaceId))?.userId === bot.userId) {
        return { left: false, error: 'The same bot still sends another workspace\'s notices to that room' };
      }
    }

    const workspace = await this.workspaceRepository.findById(room.workspaceId);
    const text = `ℹ️ ${matrixText(workspace?.defaultLanguage, 'farewell', { app: APP_NAME })}`;
    // A goodbye that does not arrive does not keep the bot in the room
    await this.client.sendMessage(bot.homeserverUrl, token, room.roomId, `ohd-farewell-${room.getId()}`, { msgtype: 'm.notice', body: text }).catch(() => undefined);
    try {
      await this.client.leaveRoom(bot.homeserverUrl, token, room.roomId);
      return { left: true, error: null };
    } catch (error) {
      return { left: false, error: (error as Error).message };
    }
  }
}
