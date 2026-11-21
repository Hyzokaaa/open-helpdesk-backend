import { MatrixRoomCreation } from '../entities/matrix-room-creation';

export interface MatrixRoomCreationRepository {
  create(creation: MatrixRoomCreation): Promise<void>;
  /** How many rooms the workspace asked the bot to create from that moment on. */
  countSince(workspaceId: string, since: Date): Promise<number>;
  delete(id: string): Promise<void>;
  /** Forgets the workspace's creations older than that moment, which no longer count. */
  deleteBefore(workspaceId: string, before: Date): Promise<void>;
}
