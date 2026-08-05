import { IdGenerator } from '../../../shared/domain/id-generator';
import { AuditLogEntry } from '../entities/audit-log-entry';
import { AuditCategory } from '../enums/audit-category.enum';
import { AuditLevel } from '../enums/audit-level.enum';
import { AuditLogRepository } from '../repositories/audit-log.repository';

interface CreateAuditLogEntryProps {
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  workspaceId: string | null;
  metadata: Record<string, unknown> | null;
  category?: string;
  level?: string;
  source?: string | null;
}

export class CreateAuditLogEntry {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: AuditLogRepository,
  ) {}

  async execute(props: CreateAuditLogEntryProps): Promise<AuditLogEntry> {
    const entry = new AuditLogEntry({
      id: this.idGenerator.create(),
      action: props.action,
      entityType: props.entityType,
      entityId: props.entityId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: props.metadata,
      category: props.category ?? AuditCategory.TICKET,
      level: props.level ?? AuditLevel.INFO,
      source: props.source ?? 'ui',
    });
    await this.repository.create(entry);
    return entry;
  }
}
