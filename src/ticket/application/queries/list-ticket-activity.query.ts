import { Query } from '../../../shared/domain/query';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { EnsureTicketAccess } from '../../domain/services/ticket-ensure-access';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface TicketActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  userName: string | null;
  metadata: Record<string, unknown> | null;
  category: string;
  level: string;
  source: string | null;
  createdAt?: Date;
}

/** Same cap the ticket page has always shown */
const ACTIVITY_LIMIT = 100;

/**
 * The audit entries of one ticket, for whoever can see that ticket and holds the activity permission.
 * Reading the whole workspace log stays behind the audit log permission.
 */
export class ListTicketActivityQuery implements Query<Props, TicketActivityItem[]> {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(props: Props): Promise<TicketActivityItem[]> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_ACTIVITY_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });
    await this.ensureTicketAccess.execute(props);

    const result = await this.auditLogRepository.findAll(
      props.workspaceId,
      { entityTypes: ['ticket'], entityId: props.ticketId, sortOrder: 'ASC' },
      1,
      ACTIVITY_LIMIT,
    );

    // Who acted, also when they are no longer a member and the client cannot name them
    const userIds = [...new Set(result.items.map((e) => e.userId).filter(Boolean))] as string[];
    const users = userIds.length > 0 ? await this.userRepository.findByIds(userIds) : [];
    const names = new Map(users.map((u) => [u.getId(), `${u.firstName} ${u.lastName}`.trim() || u.email]));

    return result.items.map((entry) => ({
      id: entry.getId(),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      userId: entry.userId,
      userName: entry.userId ? names.get(entry.userId) ?? null : null,
      metadata: entry.metadata,
      category: entry.category,
      level: entry.level,
      source: entry.source,
      createdAt: entry.createdAt,
    }));
  }
}
