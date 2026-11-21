import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { MATRIX_TEAM_ROLES } from './matrix-direct-bot-find';

export interface MatrixSetup {
  /** The user's workspaces where they may connect a bot themselves. */
  workspaces: { slug: string; name: string }[];
  /** A system admin may connect the installation's bot, for every workspace without one. */
  installation: boolean;
}

/**
 * Where a user with no bot to write to them could get one: the workspaces whose settings they
 * manage, and the installation for a system admin. Null for someone on no team (a customer):
 * personal notices on Matrix are not for them, so there is nothing to tell.
 */
export class FindMatrixSetup {
  constructor(
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string): Promise<MatrixSetup | null> {
    const memberships = (await this.memberRepository.findByUserId(userId)).filter((m) => MATRIX_TEAM_ROLES.has(m.role));
    const user = await this.userRepository.findById(userId);
    const installation = !!user?.isSystemAdmin;
    if (memberships.length === 0 && !installation) return null;

    const workspaces: MatrixSetup['workspaces'] = [];
    for (const membership of memberships) {
      if (!hasPermission(membership.role, PERMISSIONS.WORKSPACE_SETTINGS_MANAGE)) continue;
      const workspace = await this.workspaceRepository.findById(membership.workspaceId);
      if (workspace) workspaces.push({ slug: workspace.slug, name: workspace.name });
    }
    return { workspaces, installation };
  }
}
