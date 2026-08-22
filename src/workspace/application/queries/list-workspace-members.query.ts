import { Query } from '../../../shared/domain/query';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../../domain/repositories/workspace-member.repository';

interface Props {
  workspaceId: string;
  autoCreated?: boolean;
}

export interface MemberListItem {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  autoCreated: boolean;
  organizationId: string | null;
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

    const result = members.map((member) => {
      const user = userMap.get(member.userId);
      return {
        id: member.getId(),
        userId: member.userId,
        email: user?.email ?? '',
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        role: member.role,
        autoCreated: user?.autoCreated ?? false,
        organizationId: member.organizationId,
      };
    });

    if (props.autoCreated !== undefined) {
      return result.filter((m) => m.autoCreated === props.autoCreated);
    }

    return result;
  }
}
