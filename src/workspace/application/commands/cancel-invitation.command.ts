import { Command } from '../../../shared/domain/command';
import { CancelInvitation } from '../../domain/services/invitation-cancel';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../domain/permissions';

interface Props {
  workspaceId: string;
  invitationId: string;
  requestingUserId: string;
  isSystemAdmin: boolean;
}

export class CancelInvitationCommand implements Command<Props, void> {
  constructor(
    private readonly cancelInvitation: CancelInvitation,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.requestingUserId,
      permission: PERMISSIONS.WORKSPACE_INVITATIONS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    return this.cancelInvitation.execute({ invitationId: props.invitationId });
  }
}
