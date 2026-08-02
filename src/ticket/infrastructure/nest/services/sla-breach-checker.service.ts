import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

@Injectable()
export class SlaBreachCheckerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaBreachCheckerService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  onModuleInit(): void {
    this.intervalRef = setInterval(() => this.check(), FIVE_MINUTES_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async check(): Promise<void> {
    try {
      const workspaces = await this.dataSource.query(
        `SELECT id, "slaPolicy" FROM workspaces WHERE "slaPolicy" IS NOT NULL`,
      );

      if (workspaces.length === 0) return;

      let totalFirstResponse = 0;
      let totalResolution = 0;

      for (const ws of workspaces) {
        const sla = ws.slaPolicy;
        if (!sla) continue;

        const firstResponseTargets = sla.firstResponse;
        const resolutionTargets = sla.resolution;

        // Check first response breaches
        if (firstResponseTargets) {
          for (const [priority, hours] of Object.entries(firstResponseTargets)) {
            if (hours === null || hours === undefined) continue;
            const result = await this.dataSource.query(
              `UPDATE tickets SET "firstResponseBreached" = true
               WHERE "workspaceId" = $1
                 AND priority = $2
                 AND "firstResponseAt" IS NULL
                 AND "firstResponseBreached" = false
                 AND status NOT IN ('resolved', 'discarded')
                 AND "deletedAt" IS NULL
                 AND "createdAt" + ($3 || ' hours')::interval < NOW()
               RETURNING id`,
              [ws.id, priority, String(hours)],
            );
            const breachedIds: string[] = (result[0] ?? []).map((r: { id: string }) => r.id);
            totalFirstResponse += breachedIds.length;

            for (const ticketId of breachedIds) {
              await this.emitAudit(AuditAction.SLA_FIRST_RESPONSE_BREACHED, ticketId, ws.id, { priority, targetHours: hours });
            }
          }
        }

        // Check resolution breaches
        if (resolutionTargets) {
          for (const [priority, hours] of Object.entries(resolutionTargets)) {
            if (hours === null || hours === undefined) continue;
            const result = await this.dataSource.query(
              `UPDATE tickets SET "resolutionBreached" = true
               WHERE "workspaceId" = $1
                 AND priority = $2
                 AND "resolvedAt" IS NULL
                 AND "resolutionBreached" = false
                 AND status NOT IN ('resolved', 'discarded')
                 AND "deletedAt" IS NULL
                 AND "createdAt" + ($3 || ' hours')::interval < NOW()
               RETURNING id`,
              [ws.id, priority, String(hours)],
            );
            const breachedIds: string[] = (result[0] ?? []).map((r: { id: string }) => r.id);
            totalResolution += breachedIds.length;

            for (const ticketId of breachedIds) {
              await this.emitAudit(AuditAction.SLA_RESOLUTION_BREACHED, ticketId, ws.id, { priority, targetHours: hours });
            }
          }
        }
      }

      if (totalFirstResponse > 0 || totalResolution > 0) {
        this.logger.log(
          `SLA breaches detected: ${totalFirstResponse} first response, ${totalResolution} resolution`,
        );
      }
    } catch (error) {
      this.logger.error(`SLA breach check failed: ${error}`);
    }
  }

  private async emitAudit(action: AuditAction, ticketId: string, workspaceId: string, metadata: Record<string, unknown>): Promise<void> {
    const service = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await service.execute({
      action,
      entityType: 'ticket',
      entityId: ticketId,
      userId: null,
      workspaceId,
      metadata,
      category: AuditCategory.TICKET,
      level: AuditLevel.WARNING,
      source: 'system',
    });
  }
}
