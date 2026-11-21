import { MatrixIdentity } from '../entities/matrix-identity';
import { clearMatrixIdentityChange } from '../matrix-identity-status';
import { MatrixIdentityRepository } from '../repositories/matrix-identity.repository';
import { CloseMatrixDirectRooms } from './matrix-direct-rooms-close';

/**
 * Gives up changing a verified Matrix account for another before its code was typed: the bot leaves
 * the chat it sent that code to, and the verified account goes on as before. The code limits stay.
 */
export class CancelMatrixIdentityChange {
  constructor(
    private readonly repository: MatrixIdentityRepository,
    private readonly closeRooms: CloseMatrixDirectRooms,
  ) {}

  async execute(userId: string): Promise<MatrixIdentity | null> {
    const identity = await this.repository.findByUserId(userId);
    if (!identity?.pendingMatrixUserId) return identity;
    const room = identity.pendingBotId && identity.pendingRoomId ? { botId: identity.pendingBotId, roomId: identity.pendingRoomId } : null;
    clearMatrixIdentityChange(identity);
    await this.repository.save(identity);
    if (room) await this.closeRooms.leaveUnsaved(room.botId, room.roomId);
    return identity;
  }
}
