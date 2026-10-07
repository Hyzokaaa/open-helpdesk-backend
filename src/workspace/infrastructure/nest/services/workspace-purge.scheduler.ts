import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { StorageService } from '../../../../shared/domain/storage-service';
import { STORAGE_SERVICE } from '../../../../shared/shared.module';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { NestEventPublisher } from '../../../../shared/infrastructure/nest-event-publisher';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { WorkspaceLifecycleEvent } from '../../../../email/domain/events';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { SqlWorkspaceFileKeys } from '../../typeorm/workspace-file-keys.sql';
import { PurgeWorkspace } from '../../../domain/services/workspace-purge';
import { PurgeWorkspaceCommand } from '../../../application/commands/purge-workspace.command';

/** How long before its purge the owner of a deleted workspace gets a last reminder. */
export const PURGE_REMINDER_DAYS = 3;

/**
 * Once a day: reminds owners of deleted workspaces that are about to be erased, and erases the
 * ones whose recovery period is over. Idempotent, so several instances running it is harmless:
 * a workspace already purged by another one is simply not found.
 */
@Injectable()
export class WorkspacePurgeScheduler {
  private readonly logger = new Logger(WorkspacePurgeScheduler.name);

  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly eventPublisher: NestEventPublisher,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async run(now: Date = new Date()): Promise<void> {
    await this.remind(now);
    await this.purge(now);
  }

  private async remind(now: Date): Promise<void> {
    const before = new Date(now.getTime() + PURGE_REMINDER_DAYS * 24 * 60 * 60 * 1000);
    // One already past its date is purged in this same run: a reminder would come too late
    const due = (await this.workspaceRepository.findDueForPurgeReminder(before))
      .filter((w) => !w.purgeAt || w.purgeAt > now);
    for (const workspace of due) {
      try {
        await this.workspaceRepository.markPurgeReminderSent(workspace.getId(), now);
        const event: WorkspaceLifecycleEvent = {
          workspaceId: workspace.getId(),
          workspaceName: workspace.name,
          workspaceSlug: workspace.slug,
          accountId: workspace.accountId,
          purgeAt: workspace.purgeAt?.toISOString() ?? null,
          actorUserId: null,
        };
        this.eventPublisher.emit('workspace.purge-reminder', event);
      } catch (err) {
        this.logger.error(`Purge reminder for workspace ${workspace.getId()} failed: ${(err as Error).message}`);
      }
    }
  }

  private async purge(now: Date): Promise<void> {
    const due = await this.workspaceRepository.findDueForPurge(now);
    for (const workspace of due) {
      try {
        const [stats] = await this.dataSource.query(
          `SELECT (SELECT COUNT(*) FROM workspace_members WHERE "workspaceId" = $1)::int AS "memberCount",
                  (SELECT COUNT(*) FROM tickets WHERE "workspaceId" = $1)::int AS "ticketCount"`,
          [workspace.getId()],
        );
        const command = new PurgeWorkspaceCommand(
          new PurgeWorkspace(this.workspaceRepository, new SqlWorkspaceFileKeys(this.dataSource), this.storage),
          new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository),
        );
        const result = await command.execute({ workspaceId: workspace.getId(), userId: null, isSystemAdmin: false, stats });
        this.logger.log(`Purged workspace ${workspace.slug} (${workspace.getId()}), ${result.filesDeleted} files`);
      } catch (err) {
        this.logger.error(`Purge of workspace ${workspace.getId()} failed: ${(err as Error).message}`);
      }
    }
  }
}
