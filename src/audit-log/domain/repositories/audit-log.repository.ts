import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { AuditLogEntry } from '../entities/audit-log-entry';

export interface AuditLogFilters {
  actions?: string[];
  entityTypes?: string[];
  entityId?: string;
  categories?: string[];
  levels?: string[];
  sources?: string[];
  userIds?: string[];
  search?: string;
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
  findAllUnscoped(
    filters: AuditLogFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<AuditLogEntry>>;
}
