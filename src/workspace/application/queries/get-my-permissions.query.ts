import { Query } from '../../../shared/domain/query';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import { WorkspaceMemberRepository } from '../../domain/repositories/workspace-member.repository';
import { getPermissionsForRole, Permission } from '../../domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin?: boolean;
}

export interface MyPermissionsResponse {
  permissions: Permission[];
  // The caller's own membership role, or null when not a member (a system admin may not be one)
  role: WorkspaceRole | null;
}

export class GetMyPermissionsQuery implements Query<Props, MyPermissionsResponse> {
  constructor(private readonly memberRepository: WorkspaceMemberRepository) {}

  async execute(props: Props): Promise<MyPermissionsResponse> {
    const member = await this.memberRepository.findByWorkspaceAndUser(
      props.workspaceId,
      props.userId,
    );
    const role = member?.role ?? null;

    if (props.isSystemAdmin) {
      return { permissions: getPermissionsForRole(WorkspaceRole.ADMIN), role };
    }
    if (!member) return { permissions: [], role };
    return { permissions: getPermissionsForRole(member.role), role };
  }
}
