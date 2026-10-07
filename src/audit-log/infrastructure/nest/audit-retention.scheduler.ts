import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { UlidGenerator } from '../../../shared/infrastructure/ulid-generator';
import { PruneAuditLog } from '../../domain/services/audit-log-prune';
import { CreateAuditLogEntry } from '../../domain/services/audit-log-create';
import { AuditAction } from '../../domain/enums/audit-action.enum';
import { AuditCategory } from '../../domain/enums/audit-category.enum';
import { AuditLevel } from '../../domain/enums/audit-level.enum';
import { SqlAuditLogPruner } from '../typeorm/audit-log-pruner.sql';
import { TypeOrmAuditRetentionSettingsRepository } from '../typeorm/repositories/typeorm-audit-retention-settings.repository';
import { TypeOrmAuditLogRepository } from '../typeorm/repositories/typeorm-audit-log.repository';

/** The hour of the day, in the server's time zone, at which expired audit entries are deleted. */
export const AUDIT_RETENTION_HOUR = 2;

/** When the next deletion runs, so the admin panel can show it in the viewer's own time. */
export function nextAuditRetentionRun(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setHours(AUDIT_RETENTION_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

/**
 * Once a day, deletes the audit entries that outlived their retention (nothing while retention is
 * off). Idempotent: several instances running it only delete the same rows once.
 */
@Injectable()
export class AuditRetentionScheduler {
  private readonly logger = new Logger(AuditRetentionScheduler.name);

  constructor(
    @Inject() private readonly settingsRepository: TypeOrmAuditRetentionSettingsRepository,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(`0 0 ${AUDIT_RETENTION_HOUR} * * *`)
  async run(now: Date = new Date()): Promise<void> {
    try {
      const deleted = await new PruneAuditLog(this.settingsRepository, new SqlAuditLogPruner(this.dataSource)).execute(now);
      const total = Object.values(deleted).reduce((sum, n) => sum + n, 0);
      if (total === 0) return;

      this.logger.log(`Audit retention deleted ${total} entries`);
      await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
        action: AuditAction.AUDIT_LOG_PRUNED,
        entityType: 'system',
        entityId: 'audit-retention',
        userId: null,
        workspaceId: null,
        metadata: { deleted, total },
        category: AuditCategory.SYSTEM,
        level: AuditLevel.INFO,
        source: 'system',
      });
    } catch (err) {
      this.logger.error(`Audit retention failed: ${(err as Error).message}`);
    }
  }
}
