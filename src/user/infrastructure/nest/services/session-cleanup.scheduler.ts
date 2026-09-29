import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TypeOrmUserSessionRepository } from '../../typeorm/repositories/typeorm-user-session.repository';
import { PurgeStaleSessions } from '../../../domain/services/user-sessions-purge';

@Injectable()
export class SessionCleanupScheduler {
  private readonly logger = new Logger(SessionCleanupScheduler.name);

  constructor(@Inject() private readonly sessionRepository: TypeOrmUserSessionRepository) {}

  // Idempotent, so several instances running it at once is harmless
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(): Promise<void> {
    try {
      const deleted = await new PurgeStaleSessions(this.sessionRepository).execute();
      if (deleted > 0) this.logger.log(`Deleted ${deleted} stale sessions`);
    } catch (err) {
      this.logger.error(`Session cleanup failed: ${(err as Error).message}`);
    }
  }
}
