import { IdGenerator } from '../../../shared/domain/id-generator';
import { AuditLogEntry } from '../entities/audit-log-entry';
import { AuditLogRepository } from '../repositories/audit-log.repository';

interface CreateAuditLogEntryProps {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  workspaceId: string | null;
  metadata: Record<string, unknown> | null;
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
    });
    await this.repository.create(entry);
    return entry;
  }
}
