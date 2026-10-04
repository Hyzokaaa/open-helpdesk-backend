import { Command } from '../../../shared/domain/command';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { CreateInvitation } from '../../domain/services/invitation-create';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../domain/permissions';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

interface Props {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  requestingUserId: string;
  isSystemAdmin: boolean;
}

export interface CreateInvitationResponse {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  token: string;
}

export class CreateInvitationCommand implements Command<Props, CreateInvitationResponse> {
  constructor(
    private readonly createInvitation: CreateInvitation,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<CreateInvitationResponse> {
    const requester = await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.requestingUserId,
      permission: PERMISSIONS.WORKSPACE_INVITATIONS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    // Supervisors hold WORKSPACE_INVITATIONS_MANAGE but must not hand out a role above their own.
    if (props.role === WorkspaceRole.ADMIN && requester.role !== WorkspaceRole.ADMIN) {
      throw new AccessDeniedError('Only workspace admins can invite admins');
    }

    const invitation = await this.createInvitation.execute({
      workspaceId: props.workspaceId,
      email: props.email,
      role: props.role,
      invitedById: props.requestingUserId,
    });

    return {
      id: invitation.getId(),
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      token: invitation.token,
    };
  }
}
