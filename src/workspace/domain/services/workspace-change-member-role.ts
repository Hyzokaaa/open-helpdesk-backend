import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { WorkspaceMember } from '../entities/workspace-member';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';

interface ChangeMemberRoleProps {
  workspaceId: string;
  targetUserId: string;
  newRole: WorkspaceRole;
  requestingUserId: string;
  isSystemAdmin: boolean;
}

export class ChangeWorkspaceMemberRole {
  constructor(private readonly repository: WorkspaceMemberRepository) {}

  async execute(props: ChangeMemberRoleProps): Promise<WorkspaceMember> {
    const target = await this.repository.findByWorkspaceAndUser(
      props.workspaceId,
      props.targetUserId,
    );
    if (!target) throw new EntityNotFoundError('Member not found in this workspace');

    if (!props.isSystemAdmin) {
      const requester = await this.repository.findByWorkspaceAndUser(
        props.workspaceId,
        props.requestingUserId,
      );
      if (!requester || requester.role !== WorkspaceRole.ADMIN) {
        throw new AccessDeniedError('Only workspace admins can change member roles');
      }

      if (target.role === WorkspaceRole.ADMIN) {
        throw new AccessDeniedError('Only system admins can change the role of another admin');
      }

      if (props.newRole === WorkspaceRole.ADMIN) {
        throw new AccessDeniedError('Only system admins can promote members to admin');
      }
    }

    if (target.role === WorkspaceRole.ADMIN && props.newRole !== WorkspaceRole.ADMIN) {
      const members = await this.repository.findByWorkspaceId(props.workspaceId);
      const adminCount = members.filter((m) => m.role === WorkspaceRole.ADMIN).length;
      if (adminCount <= 1) {
        throw new DomainValidationError('Cannot remove the last admin of a workspace');
      }
    }

    target.role = props.newRole;
    await this.repository.update(target);
    return target;
  }
}
