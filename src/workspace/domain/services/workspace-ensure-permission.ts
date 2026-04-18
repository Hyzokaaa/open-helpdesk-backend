import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { Permission, hasPermission } from '../permissions';

interface EnsurePermissionProps {
  workspaceId: string;
  userId: string;
  permission: Permission;
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
    const member = await this.memberRepository.findByWorkspaceAndUser(
      props.workspaceId,
      props.userId,
    );

    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (!hasPermission(member.role, props.permission)) {
      throw new ForbiddenException(
        `Insufficient permissions: ${props.permission}`,
      );
    }

    return { userId: member.userId, role: member.role };
  }
}
