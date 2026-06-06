import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

@Injectable()
export class SlaBreachCheckerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaBreachCheckerService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly dataSource: DataSource) {}

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
                 AND "createdAt" + ($3 || ' hours')::interval < NOW()`,
              [ws.id, priority, String(hours)],
            );
            totalFirstResponse += result[1] ?? 0;
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
                 AND "createdAt" + ($3 || ' hours')::interval < NOW()`,
              [ws.id, priority, String(hours)],
            );
            totalResolution += result[1] ?? 0;
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
}
