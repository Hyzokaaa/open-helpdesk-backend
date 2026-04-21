import { Command } from '../../../shared/domain/command';
import { RemoveWorkspaceMember } from '../../domain/services/workspace-remove-member';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  requestingUserId: string;
}

export class RemoveMemberCommand implements Command<Props, void> {
  constructor(
    private readonly removeMember: RemoveWorkspaceMember,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.requestingUserId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
    });

    await this.removeMember.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
    });
  }
}
