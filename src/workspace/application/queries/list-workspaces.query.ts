import { Query } from '../../../shared/domain/query';
import { WorkspaceMemberRepository } from '../../domain/repositories/workspace-member.repository';
import { WorkspaceRepository } from '../../domain/repositories/workspace.repository';

interface Props {
  userId: string;
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  role: string;
}

export class ListWorkspacesQuery implements Query<Props, WorkspaceListItem[]> {
  constructor(
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async execute(props: Props): Promise<WorkspaceListItem[]> {
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
