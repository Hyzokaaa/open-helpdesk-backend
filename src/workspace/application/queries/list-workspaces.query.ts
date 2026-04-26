import { Query } from '../../../shared/domain/query';
import { AccountRepository } from '../../../account/domain/repositories/account.repository';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../../domain/repositories/workspace-member.repository';
import { WorkspaceRepository } from '../../domain/repositories/workspace.repository';

interface Props {
  userId: string;
  isSystemAdmin?: boolean;
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  role: string;
  ownerName?: string;
}

export class ListWorkspacesQuery implements Query<Props, WorkspaceListItem[]> {
  constructor(
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly accountRepository?: AccountRepository,
    private readonly userRepository?: UserRepository,
  ) {}

  async execute(props: Props): Promise<WorkspaceListItem[]> {
    if (props.isSystemAdmin) {
      const allWorkspaces = await this.workspaceRepository.findAll();
      const result: WorkspaceListItem[] = [];
      for (const workspace of allWorkspaces) {
        const membership = await this.memberRepository.findByWorkspaceAndUser(workspace.getId(), props.userId);
        let ownerName: string | undefined;
        if (workspace.accountId && this.accountRepository && this.userRepository) {
          const account = await this.accountRepository.findById(workspace.accountId);
          if (account) {
            const owner = await this.userRepository.findById(account.ownerId);
            if (owner) ownerName = `${owner.firstName} ${owner.lastName}`;
          }
        }
        result.push({
          id: workspace.getId(),
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          role: membership?.role ?? 'admin',
          ownerName,
        });
      }
      return result;
    }

    const memberships = await this.memberRepository.findByUserId(props.userId);

    const workspaces: WorkspaceListItem[] = [];
    for (const membership of memberships) {
      const workspace = await this.workspaceRepository.findById(membership.workspaceId);
      if (workspace) {
        workspaces.push({
          id: workspace.getId(),
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          role: membership.role,
        });
      }
    }

    return workspaces;
  }
}
