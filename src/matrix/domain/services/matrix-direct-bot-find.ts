import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';

/** Personal notices are for the team: customers keep theirs in the app and by email. */
export const MATRIX_TEAM_ROLES = new Set<WorkspaceRole>([WorkspaceRole.ADMIN, WorkspaceRole.SUPERVISOR, WorkspaceRole.AGENT]);

/**
 * The bot that verifies a user's Matrix account: the installation's when one of their workspaces
 * uses it, else the own bot of one of their workspaces. Null when none of their workspaces where
 * they are on the team can write on Matrix, or they are on no team at all.
 */
export class FindMatrixDirectBot {
  constructor(
    private readonly botRepository: MatrixBotRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string): Promise<MatrixBot | null> {
    const workspaceIds = (await this.memberRepository.findByUserId(userId)).filter((m) => MATRIX_TEAM_ROLES.has(m.role)).map((m) => m.workspaceId);
    const installation = await this.botRepository.findInstallation();
    const user = workspaceIds.length === 0 ? await this.userRepository.findById(userId) : null;
    if (workspaceIds.length === 0 && !user?.isSystemAdmin) return null;
    if (workspaceIds.length === 0) return installation;

    let ownBot: MatrixBot | null = null;
    for (const workspaceId of workspaceIds) {
      const own = await this.botRepository.findByWorkspaceId(workspaceId);
      if (!own && installation) return installation;
      ownBot ??= own;
    }
    return ownBot;
  }
}
