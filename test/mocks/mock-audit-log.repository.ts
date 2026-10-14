import { PaginatedResult } from '../../src/shared/domain/paginated-result';
import { AuditLogEntry } from '../../src/audit-log/domain/entities/audit-log-entry';
import { AuditLogFilters, AuditLogRepository } from '../../src/audit-log/domain/repositories/audit-log.repository';
import { AuditActivityRepository } from '../../src/audit-log/domain/repositories/audit-activity.repository';

export class MockAuditLogRepository implements AuditLogRepository, AuditActivityRepository {
  readonly entries: AuditLogEntry[] = [];

  async create(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);
  }

  async findAll(workspaceId: string | null, _filters: AuditLogFilters, page: number, limit: number): Promise<PaginatedResult<AuditLogEntry>> {
    const items = this.entries.filter((e) => workspaceId === null || e.workspaceId === workspaceId);
    return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit };
  }

  async findAllUnscoped(_filters: AuditLogFilters, page: number, limit: number): Promise<PaginatedResult<AuditLogEntry>> {
    return { items: this.entries.slice((page - 1) * limit, page * limit), total: this.entries.length, page, limit };
  }

  async findLastActivityAt(workspaceId: string, entityType: string, entityId: string): Promise<Date | null> {
    const times = this.entries
      .filter((e) => e.workspaceId === workspaceId && e.entityType === entityType && e.entityId === entityId && e.userId !== null)
      .map((e) => e.createdAt?.getTime() ?? 0);
    return times.length > 0 ? new Date(Math.max(...times)) : null;
  }
}
