import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmNotificationRepository } from '../../../../notification/infrastructure/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../../../notification/infrastructure/typeorm/repositories/typeorm-notification-preference.repository';
import { DispatchNotifications } from '../../../../notification/domain/services/notification-dispatch';
import { TypeOrmWorkspaceInvitationRepository } from '../../typeorm/repositories/typeorm-workspace-invitation.repository';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { NotifyExpiredInvitations } from '../../../domain/services/invitation-notify-expired';

/** Invitations handled per run; a larger backlog is spread over the following hours */
const BATCH = 200;

/** Every hour: tells inviters about the invitations of theirs that expired since the last run. */
@Injectable()
export class InvitationExpiryScheduler {
  private readonly logger = new Logger(InvitationExpiryScheduler.name);

  constructor(
    @Inject() private readonly invitationRepository: TypeOrmWorkspaceInvitationRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly notificationRepository: TypeOrmNotificationRepository,
    @Inject() private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(now: Date = new Date()): Promise<void> {
    try {
      const notify = new NotifyExpiredInvitations(
        this.invitationRepository,
        this.workspaceRepository,
        this.userRepository,
        new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository),
        new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository),
      );
      const count = await notify.execute({ now, limit: BATCH });
      if (count > 0) this.logger.log(`Notified ${count} expired invitation(s)`);
    } catch (err) {
      this.logger.error(`Expired invitation check failed: ${(err as Error).message}`);
    }
  }
}
