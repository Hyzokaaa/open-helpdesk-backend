import { Command } from '../../../shared/domain/command';
import { AddWorkspaceMember } from '../../domain/services/workspace-add-member';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../domain/permissions';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

interface Props {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  requestingUserId: string;
}

export interface AddMemberResponse {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export class AddMemberCommand implements Command<Props, AddMemberResponse> {
  constructor(
    private readonly addMember: AddWorkspaceMember,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<AddMemberResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.requestingUserId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
    });

    const member = await this.addMember.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      role: props.role,
    });

    return {
      id: member.getId(),
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role,
    };
  }
}
