import { MatrixBot } from '../entities/matrix-bot';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';

/** The bot a workspace writes with: its own, else the installation's, else none. */
export class ResolveMatrixBot {
  constructor(private readonly repository: MatrixBotRepository) {}

  async execute(workspaceId: string): Promise<MatrixBot | null> {
    return (await this.repository.findByWorkspaceId(workspaceId)) ?? (await this.repository.findInstallation());
  }
}
