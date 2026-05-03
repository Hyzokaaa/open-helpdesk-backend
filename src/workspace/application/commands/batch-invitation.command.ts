import { Command } from '../../../shared/domain/command';
import { CreateInvitation } from '../../domain/services/invitation-create';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../domain/permissions';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

interface InvitationEntry {
  email: string;
  role: WorkspaceRole;
}

interface Props {
  workspaceId: string;
  invitations: InvitationEntry[];
  requestingUserId: string;
  isSystemAdmin: boolean;
}

export interface BatchInvitationResult {
  email: string;
  status: 'sent' | 'error';
  error?: string;
}

export class BatchInvitationCommand implements Command<Props, BatchInvitationResult[]> {
  constructor(
    private readonly createInvitation: CreateInvitation,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<BatchInvitationResult[]> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.requestingUserId,
      permission: PERMISSIONS.WORKSPACE_INVITATIONS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const results: BatchInvitationResult[] = [];

    for (const entry of props.invitations) {
      try {
        await this.createInvitation.execute({
          workspaceId: props.workspaceId,
          email: entry.email,
          role: entry.role,
          invitedById: props.requestingUserId,
        });
        results.push({ email: entry.email, status: 'sent' });
      } catch (err: any) {
        results.push({ email: entry.email, status: 'error', error: err.message });
      }
    }

    return results;
  }
}
