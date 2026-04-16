import { Query } from '../../../shared/domain/query';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../../domain/repositories/workspace-member.repository';

interface Props {
  workspaceId: string;
}

export interface MemberListItem {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export class ListWorkspaceMembersQuery implements Query<Props, MemberListItem[]> {
  constructor(
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(props: Props): Promise<MemberListItem[]> {
    const members = await this.memberRepository.findByWorkspaceId(props.workspaceId);
    const userIds = members.map((m) => m.userId);
    const users = await this.userRepository.findByIds(userIds);

    const userMap = new Map(users.map((u) => [u.getId(), u]));

    return members.map((member) => {
      const user = userMap.get(member.userId);
      return {
        id: member.getId(),
        userId: member.userId,
        email: user?.email ?? '',
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        role: member.role,
      };
    });
  }
}
