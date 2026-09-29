import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';

interface AuthorizeWorkspaceChannelProps {
  /** One of the two: slug when a client asks to join, id when re-checking a joined channel. */
  workspaceSlug?: string;
  workspaceId?: string;
  userId: string;
  isSystemAdmin: boolean;
}

/**
 * Decides whether a user may listen to a workspace's live events: members and system admins.
 * Returns the workspace id the channel is keyed by, or null.
 */
export class AuthorizeWorkspaceChannel {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
  ) {}

  async execute(props: AuthorizeWorkspaceChannelProps): Promise<string | null> {
    const workspace = props.workspaceId
      ? await this.workspaceRepository.findById(props.workspaceId)
      : props.workspaceSlug
        ? await this.workspaceRepository.findBySlug(props.workspaceSlug)
        : null;
    if (!workspace) return null;

    const workspaceId = workspace.getId();
    if (props.isSystemAdmin) return workspaceId;

    const member = await this.memberRepository.findByWorkspaceAndUser(workspaceId, props.userId);
    return member ? workspaceId : null;
  }
}
