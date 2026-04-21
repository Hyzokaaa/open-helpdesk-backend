import { Query } from '../../../shared/domain/query';
import { WorkspaceMemberRepository } from '../../domain/repositories/workspace-member.repository';
import { getPermissionsForRole, Permission } from '../../domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
}

export interface MyPermissionsResponse {
  permissions: Permission[];
}

export class GetMyPermissionsQuery implements Query<Props, MyPermissionsResponse> {
  constructor(private readonly memberRepository: WorkspaceMemberRepository) {}

  async execute(props: Props): Promise<MyPermissionsResponse> {
    const member = await this.memberRepository.findByWorkspaceAndUser(
      props.workspaceId,
      props.userId,
    );
    if (!member) return { permissions: [] };
    return { permissions: getPermissionsForRole(member.role) };
  }
}
