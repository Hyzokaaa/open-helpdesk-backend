import { MatrixBot } from '../entities/matrix-bot';

export interface MatrixBotRepository {
  /** The installation's bot. */
  findInstallation(): Promise<MatrixBot | null>;
  findByWorkspaceId(workspaceId: string): Promise<MatrixBot | null>;
  findById(id: string): Promise<MatrixBot | null>;
  /** Every bot: the installation's and the workspaces'. */
  findAll(): Promise<MatrixBot[]>;
  save(bot: MatrixBot): Promise<void>;
  delete(id: string): Promise<void>;
}
