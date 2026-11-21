import { EntityNotFoundError } from '../../../shared/domain/errors';
import { MatrixRoom } from '../entities/matrix-room';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';

/** Pauses one room's notices until a test notice reaches it, as when the bot loses access. */
export class PauseMatrixRoom {
  constructor(private readonly repository: MatrixRoomRepository) {}

  async execute(workspaceId: string, id: string): Promise<MatrixRoom> {
    const room = await this.repository.findById(id);
    if (!room || room.workspaceId !== workspaceId) throw new EntityNotFoundError('Matrix room not found');
    room.isActive = false;
    await this.repository.save(room);
    return room;
  }
}
