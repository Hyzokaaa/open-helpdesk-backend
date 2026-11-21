import { MatrixRoom } from '../entities/matrix-room';

export interface MatrixRoomRepository {
  findById(id: string): Promise<MatrixRoom | null>;
  findByWorkspaceId(workspaceId: string): Promise<MatrixRoom[]>;
  /** The rooms the installation's bot writes in: those of workspaces without a bot of their own. */
  findForInstallationBot(): Promise<MatrixRoom[]>;
  /** The rooms of other workspaces with this Matrix room ID. */
  findByRoomId(roomId: string): Promise<MatrixRoom[]>;
  save(room: MatrixRoom): Promise<void>;
  delete(id: string): Promise<void>;
}
