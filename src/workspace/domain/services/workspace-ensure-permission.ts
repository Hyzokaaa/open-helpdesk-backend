import { AccessDeniedError } from '../../../shared/domain/errors';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { Permission, hasPermission } from '../permissions';

interface EnsurePermissionProps {
  workspaceId: string;
  userId: string;
  permission: Permission;
  isSystemAdmin?: boolean;
}

export interface MemberContext {
  userId: string;
  role: WorkspaceRole;
}

export class EnsureWorkspacePermission {
  constructor(
    private readonly memberRepository: WorkspaceMemberRepository,
  ) {}

  async execute(props: EnsurePermissionProps): Promise<MemberContext> {
    if (props.isSystemAdmin) {
      return { userId: props.userId, role: WorkspaceRole.ADMIN };
    }

    const member = await this.memberRepository.findByWorkspaceAndUser(
      props.workspaceId,
      props.userId,
    );

    if (!member) {
      throw new AccessDeniedError('You are not a member of this workspace');
    }

    if (!hasPermission(member.role, props.permission)) {
      throw new AccessDeniedError(
        `Insufficient permissions: ${props.permission}`,
      );
    }

    return { userId: member.userId, role: member.role };
  }
}
