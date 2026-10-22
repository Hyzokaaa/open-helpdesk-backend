import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { NestEventPublisher } from '../../../../shared/infrastructure/nest-event-publisher';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { CustomDomainCheckEvent } from '../../../../email/domain/events';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { CustomDomainCheckOutcome, RecheckCustomDomain } from '../../../domain/services/workspace-recheck-custom-domain';
import { keepsVerificationRecord, pointsToInstallation } from '../../../domain/services/workspace-verify-custom-domain';
import { Workspace } from '../../../domain/entities/workspace';

const AUDIT: Partial<Record<CustomDomainCheckOutcome, { action: AuditAction; level: AuditLevel }>> = {
  'started-failing': { action: AuditAction.WORKSPACE_CUSTOM_DOMAIN_CHECK_FAILED, level: AuditLevel.WARNING },
  distrusted: { action: AuditAction.WORKSPACE_CUSTOM_DOMAIN_DISTRUSTED, level: AuditLevel.WARNING },
  recovered: { action: AuditAction.WORKSPACE_CUSTOM_DOMAIN_RECOVERED, level: AuditLevel.INFO },
};

const EVENTS: Partial<Record<CustomDomainCheckOutcome, string>> = {
  'started-failing': 'workspace.custom-domain-failing',
  distrusted: 'workspace.custom-domain-distrusted',
};

/**
 * Once a day: checks that every verified custom domain still points to the installation (see
 * RecheckCustomDomain). Without CUSTOM_DOMAIN_CNAME_TARGET there is nothing to check against, so
 * it does nothing. Idempotent per day, so several instances running it only count a day twice
 * if they run at different times; the threshold is small enough for that not to matter.
 */
@Injectable()
export class CustomDomainCheckScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(CustomDomainCheckScheduler.name);

  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly eventPublisher: NestEventPublisher,
    private readonly config: ConfigService,
  ) {}

  /** Custom domains in use without a target: tell the operator once, at startup. */
  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('CUSTOM_DOMAIN_CNAME_TARGET')?.trim()) return;
    try {
      const count = (await this.workspaceRepository.findWithVerifiedCustomDomain()).length;
      if (count === 0) return;
      this.logger.warn(
        `${count} workspace(s) use a custom domain but CUSTOM_DOMAIN_CNAME_TARGET is not set: `
        + 'new domains cannot be verified and the daily DNS check does not run. Set it to a host that resolves to this server.',
      );
    } catch {
      // The database may not be ready yet; the warning is only a hint
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async run(now: Date = new Date()): Promise<void> {
    const target = this.config.get<string>('CUSTOM_DOMAIN_CNAME_TARGET')?.trim();
    if (!target) return;

    const recheck = new RecheckCustomDomain(this.workspaceRepository, (domain) => pointsToInstallation(domain, target), keepsVerificationRecord);
    for (const workspace of await this.workspaceRepository.findWithVerifiedCustomDomain()) {
      try {
        const outcome = await recheck.execute(workspace, now);
        await this.report(workspace, outcome);
      } catch (err) {
        this.logger.error(`Custom domain check for workspace ${workspace.getId()} failed: ${(err as Error).message}`);
      }
    }
  }

  private async report(workspace: Workspace, outcome: CustomDomainCheckOutcome): Promise<void> {
    const audit = AUDIT[outcome];
    if (audit) {
      await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
        action: audit.action,
        entityType: 'workspace',
        entityId: workspace.getId(),
        userId: null,
        workspaceId: workspace.getId(),
        metadata: { domain: workspace.customDomain, failures: workspace.customDomainCheckFailures },
        category: AuditCategory.WORKSPACE,
        level: audit.level,
        source: 'system',
      });
    }

    const event = EVENTS[outcome];
    if (event && workspace.customDomain && workspace.customDomainFailingSince) {
      const data: CustomDomainCheckEvent = {
        workspaceId: workspace.getId(),
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        domain: workspace.customDomain,
        failingSince: workspace.customDomainFailingSince.toISOString(),
      };
      this.eventPublisher.emit(event, data);
    }
  }
}
