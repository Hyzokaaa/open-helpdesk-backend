import { User } from '../../../user/domain/entities/user';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

interface Props {
  workspaceId: string;
  excludeUserId?: string;
}

export class ResolveWorkspaceAdmins {
  constructor(
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(props: Props): Promise<User[]> {
    const members = await this.memberRepository.findByWorkspaceId(props.workspaceId);
    const ids = members
      .filter((m) => m.role === WorkspaceRole.ADMIN || m.role === WorkspaceRole.SUPERVISOR)
      .map((m) => m.userId)
      .filter((id) => id !== props.excludeUserId);

    if (ids.length === 0) return [];
    return this.userRepository.findByIds(ids);
  }
}
