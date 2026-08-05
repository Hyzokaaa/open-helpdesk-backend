import { Command } from '../../../shared/domain/command';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { ToggleSystemAdmin } from '../../domain/services/user-toggle-system-admin';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  targetUserId: string;
  isSystemAdmin: boolean;
  requestingUserIsAdmin: boolean;
  requestingUserId: string;
}

export interface ToggleSystemAdminResponse {
  id: string;
  isSystemAdmin: boolean;
}

export class ToggleSystemAdminCommand implements Command<Props, ToggleSystemAdminResponse> {
  constructor(
    private readonly toggleSystemAdmin: ToggleSystemAdmin,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<ToggleSystemAdminResponse> {
    if (!props.requestingUserIsAdmin) {
      throw new AccessDeniedError('Only system admins can manage system admin roles');
    }

    const user = await this.toggleSystemAdmin.execute({
      targetUserId: props.targetUserId,
      isSystemAdmin: props.isSystemAdmin,
    });

    await this.createAuditLog.execute({
      action: AuditAction.USER_ADMIN_TOGGLED,
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'user',
      entityId: props.targetUserId,
      userId: props.requestingUserId,
      workspaceId: null,
      metadata: { target: `${user.firstName} ${user.lastName} (${user.email})`, isSystemAdmin: props.isSystemAdmin },
    });

    return { id: user.getId(), isSystemAdmin: user.isSystemAdmin };
  }
}
