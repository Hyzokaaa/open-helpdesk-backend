import { MatrixClient } from '../matrix-client';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';
import { ResolveMatrixBot } from './matrix-bot-resolve';
import { CheckMatrixRoom } from './matrix-room-check';
import { SecretCipher } from '../../../shared/domain/secret-cipher';

/**
 * Takes the bot out of a room it joined only to check it, when the room was not saved after all.
 * It stays when the same bot account writes there for any workspace. Never throws: leaving is a
 * courtesy, nothing depends on it.
 */
export class LeaveCheckedMatrixRoom {
  constructor(
    private readonly botRepository: MatrixBotRepository,
    private readonly roomRepository: MatrixRoomRepository,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
  ) {}

  async execute(props: { workspaceId: string; room: string }): Promise<{ left: boolean }> {
    try {
      const resolved = await new CheckMatrixRoom(this.botRepository, this.roomRepository, this.client, this.cipher).resolve(props.workspaceId, props.room);
      const resolve = new ResolveMatrixBot(this.botRepository);
      for (const saved of await this.roomRepository.findByRoomId(resolved.roomId)) {
        if ((await resolve.execute(saved.workspaceId))?.userId === resolved.bot.userId) return { left: false };
      }
      await this.client.leaveRoom(resolved.bot.homeserverUrl, resolved.token, resolved.roomId);
      return { left: true };
    } catch {
      return { left: false };
    }
  }
}
