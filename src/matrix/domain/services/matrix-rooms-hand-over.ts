import { MatrixBot } from '../entities/matrix-bot';
import { MatrixClient } from '../matrix-client';
import { MatrixDirectRoomRepository } from '../repositories/matrix-direct-room.repository';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';

/** Rooms handed over at once: fast with many rooms, without tripping the server's rate limit. */
const AT_ONCE = 4;

export interface MatrixRoomsHandOver {
  /** Rooms the new bot is in now. */
  moved: number;
  /** Rooms it could not get into, and why: someone has to invite it there. */
  notMoved: Array<{ roomId: string; error: string }>;
}

/**
 * When a bot is replaced by another account, gets the new bot into the rooms the old one wrote
 * in, so they are not paused at the next notice: the new bot joins if it may (it was already
 * invited, or the room lets it), else the old bot invites it first. Runs before the old bot's
 * session is ended. Users' direct chats are handed over too, and the old bot leaves them; a chat it
 * could not hand over is forgotten, so the next notice opens a new one.
 */
export class HandOverMatrixRooms {
  constructor(
    private readonly roomRepository: MatrixRoomRepository,
    private readonly client: MatrixClient,
    private readonly directRoomRepository: MatrixDirectRoomRepository,
  ) {}

  async execute(props: { old: MatrixBot; oldToken: string | null; bot: MatrixBot; token: string }): Promise<MatrixRoomsHandOver> {
    const rooms = props.bot.workspaceId
      ? await this.roomRepository.findByWorkspaceId(props.bot.workspaceId)
      : await this.roomRepository.findForInstallationBot();
    const roomIds = [...new Set(rooms.map((r) => r.roomId))];
    const handOver: MatrixRoomsHandOver = { moved: 0, notMoved: [] };
    const queue = [...roomIds];
    const worker = async () => {
      for (let roomId = queue.shift(); roomId; roomId = queue.shift()) {
        try {
          await this.bringIn(props, roomId);
          handOver.moved++;
        } catch (error) {
          handOver.notMoved.push({ roomId, error: (error as Error).message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
    await this.handOverDirectChats(props);
    handOver.notMoved.sort((a, b) => roomIds.indexOf(a.roomId) - roomIds.indexOf(b.roomId));
    return handOver;
  }

  /** The bot row keeps its id when another account replaces it, so the chats stay the bot's. */
  private async handOverDirectChats(props: { old: MatrixBot; oldToken: string | null; bot: MatrixBot; token: string }): Promise<void> {
    const queue = await this.directRoomRepository.findByBotId(props.bot.getId());
    const worker = async () => {
      for (let room = queue.shift(); room; room = queue.shift()) {
        const moved = await this.bringIn(props, room.roomId).then(() => true, () => false);
        if (props.oldToken) await this.client.leaveRoom(props.old.homeserverUrl, props.oldToken, room.roomId).catch(() => undefined);
        if (!moved) await this.directRoomRepository.delete(room.getId());
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
  }

  private async bringIn(props: { old: MatrixBot; oldToken: string | null; bot: MatrixBot; token: string }, roomId: string): Promise<void> {
    const join = () => this.client.joinRoom(props.bot.homeserverUrl, props.token, roomId);
    try {
      await join();
      return;
    } catch (error) {
      if (!props.oldToken) throw error;
    }
    await this.client.invite(props.old.homeserverUrl, props.oldToken, roomId, props.bot.userId);
    await join();
  }
}
