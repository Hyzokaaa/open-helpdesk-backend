import { TooManyRequestsError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { MatrixRoomCreation } from '../entities/matrix-room-creation';
import { MatrixRoomCreationRepository } from '../repositories/matrix-room-creation.repository';

/** Each room can invite up to 20 people: more a day would be the bot sending invitations in bulk. */
export const MATRIX_ROOMS_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Counts a room the bot is about to create for a workspace, or refuses it when the workspace
 * already had MATRIX_ROOMS_PER_DAY in the last 24 hours. The creation is written before it is
 * counted, so two requests at the same moment cannot both pass the last free place; the one that
 * goes over takes its own back. A creation that failed is given back with release().
 */
export class ReserveMatrixRoomCreation {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: MatrixRoomCreationRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(workspaceId: string): Promise<MatrixRoomCreation> {
    const now = this.now();
    const since = new Date(now.getTime() - DAY_MS);
    await this.repository.deleteBefore(workspaceId, since);
    const creation = new MatrixRoomCreation({ id: this.idGenerator.create(), workspaceId, createdAt: now });
    await this.repository.create(creation);
    if (await this.repository.countSince(workspaceId, since) > MATRIX_ROOMS_PER_DAY) {
      await this.repository.delete(creation.getId());
      throw new TooManyRequestsError(`The bot already created ${MATRIX_ROOMS_PER_DAY} rooms for this workspace today: try again tomorrow, or create the room yourself and invite the bot`, 'matrix-too-many-rooms');
    }
    return creation;
  }

  async release(creation: MatrixRoomCreation): Promise<void> {
    await this.repository.delete(creation.getId());
  }
}
