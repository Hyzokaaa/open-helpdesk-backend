import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { AuditLogEntry } from '../entities/audit-log-entry';

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortOrder?: 'ASC' | 'DESC';
}

export interface AuditLogRepository {
  create(entry: AuditLogEntry): Promise<void>;
  findAll(
    workspaceId: string | null,
    filters: AuditLogFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<AuditLogEntry>>;
}
