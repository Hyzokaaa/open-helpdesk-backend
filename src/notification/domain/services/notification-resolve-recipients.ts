import { User } from '../../../user/domain/entities/user';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

interface ResolveRecipientsProps {
  workspaceId: string;
  excludeUserId: string;
  roles?: WorkspaceRole[];
}

export class ResolveNotificationRecipients {
  constructor(
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(props: ResolveRecipientsProps): Promise<User[]> {
    const roles = props.roles ?? [WorkspaceRole.ADMIN, WorkspaceRole.AGENT];
    const members = await this.memberRepository.findByWorkspaceId(props.workspaceId);
    const filtered = members.filter((m) => roles.includes(m.role as WorkspaceRole));
    if (filtered.length === 0) return [];

    const users = await this.userRepository.findByIds(filtered.map((m) => m.userId));
    return users.filter((u) => u.getId() !== props.excludeUserId);
  }
}
