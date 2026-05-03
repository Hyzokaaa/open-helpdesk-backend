import { Query } from '../../../shared/domain/query';
import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { AuditLogFilters, AuditLogRepository } from '../../domain/repositories/audit-log.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  filters: AuditLogFilters;
  page: number;
  limit: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  workspaceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
}

export class ListAuditLogQuery implements Query<Props, PaginatedResult<AuditLogItem>> {
  constructor(
    private readonly repository: AuditLogRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<PaginatedResult<AuditLogItem>> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.AUDIT_LOG_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const result = await this.repository.findAll(
      props.workspaceId,
      props.filters,
      props.page,
      props.limit,
    );

    return {
      items: result.items.map((entry) => ({
        id: entry.getId(),
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId,
        workspaceId: entry.workspaceId,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
