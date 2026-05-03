import { Command } from '../../../shared/domain/command';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { ToggleUserActive } from '../../domain/services/user-toggle-active';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';

interface Props {
  targetUserId: string;
  isActive: boolean;
  requestingUserIsAdmin: boolean;
  requestingUserId: string;
}

export interface ToggleUserActiveResponse {
  id: string;
  isActive: boolean;
}

export class ToggleUserActiveCommand implements Command<Props, ToggleUserActiveResponse> {
  constructor(
    private readonly toggleActive: ToggleUserActive,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<ToggleUserActiveResponse> {
    if (!props.requestingUserIsAdmin) {
      throw new AccessDeniedError('Only system admins can activate/deactivate users');
    }

    const user = await this.toggleActive.execute({
      targetUserId: props.targetUserId,
      isActive: props.isActive,
    });

    await this.createAuditLog.execute({
      action: props.isActive ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED,
      entityType: 'user',
      entityId: props.targetUserId,
      userId: props.requestingUserId,
      workspaceId: null,
      metadata: { target: `${user.firstName} ${user.lastName} (${user.email})`, isActive: props.isActive },
    });

    return { id: user.getId(), isActive: user.isActive };
  }
}
