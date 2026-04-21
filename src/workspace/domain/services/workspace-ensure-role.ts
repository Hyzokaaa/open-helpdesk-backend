import { AccessDeniedError } from '../../../shared/domain/errors';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';

interface EnsureRoleProps {
  workspaceId: string;
  userId: string;
  allowedRoles: WorkspaceRole[];
}

export class EnsureWorkspaceRole {
  constructor(
    private readonly memberRepository: WorkspaceMemberRepository,
  ) {}

  async execute(props: EnsureRoleProps): Promise<void> {
    const member = await this.memberRepository.findByWorkspaceAndUser(
      props.workspaceId,
      props.userId,
    );

    if (!member) {
      throw new AccessDeniedError('You are not a member of this workspace');
    }

    if (!props.allowedRoles.includes(member.role)) {
      throw new AccessDeniedError(
        `Insufficient permissions. Required role: ${props.allowedRoles.join(' or ')}`,
      );
    }
  }
}
