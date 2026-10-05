import { PaginatedResult } from '../../src/shared/domain/paginated-result';
import { AuditLogEntry } from '../../src/audit-log/domain/entities/audit-log-entry';
import { AuditLogFilters, AuditLogRepository } from '../../src/audit-log/domain/repositories/audit-log.repository';

export class MockAuditLogRepository implements AuditLogRepository {
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
}
