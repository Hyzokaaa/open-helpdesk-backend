import { EntityNotFoundError } from '../../../shared/domain/errors';
import { MatrixRoom } from '../entities/matrix-room';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';
import { LeaveMatrixRoom, MatrixRoomLeft } from './matrix-room-leave';

/** Stops one room's notices: forgets it, and the bot leaves the room when asked. */
export class RemoveMatrixRoom {
  constructor(
    private readonly repository: MatrixRoomRepository,
    private readonly leave: LeaveMatrixRoom,
  ) {}

  async execute(workspaceId: string, id: string, botLeaves = false): Promise<{ room: MatrixRoom; left: MatrixRoomLeft | null }> {
    const room = await this.repository.findById(id);
    if (!room || room.workspaceId !== workspaceId) throw new EntityNotFoundError('Matrix room not found');
    await this.repository.delete(room.getId());
    return { room, left: botLeaves ? await this.leave.execute(room) : null };
  }
}
