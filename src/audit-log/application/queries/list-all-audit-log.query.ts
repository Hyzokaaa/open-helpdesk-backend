import { ForbiddenException } from '@nestjs/common';
import { Query } from '../../../shared/domain/query';
import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { AuditLogFilters, AuditLogRepository } from '../../domain/repositories/audit-log.repository';
import { AuditLogItem } from './list-audit-log.query';

interface Props {
  isSystemAdmin: boolean;
  filters: AuditLogFilters;
  page: number;
  limit: number;
}

export class ListAllAuditLogQuery implements Query<Props, PaginatedResult<AuditLogItem>> {
  constructor(
    private readonly repository: AuditLogRepository,
  ) {}

  async execute(props: Props): Promise<PaginatedResult<AuditLogItem>> {
    if (!props.isSystemAdmin) {
      throw new ForbiddenException();
    }

    const result = await this.repository.findAllUnscoped(
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
        category: entry.category,
        level: entry.level,
        source: entry.source,
        createdAt: entry.createdAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
