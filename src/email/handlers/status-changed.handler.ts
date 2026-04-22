import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { StatusChangedTemplate } from '../templates/status-changed.template';
import { StatusChangedEvent } from '../domain/events';
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmNotificationRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification-preference.repository';
import { UlidGenerator } from '../../shared/infrastructure/ulid-generator';
import { ResolveNotificationRecipients } from '../../notification/domain/services/notification-resolve-recipients';
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';

@Injectable()
export class StatusChangedHandler {
  private readonly logger = new Logger(StatusChangedHandler.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly notificationRepository: TypeOrmNotificationRepository,
    private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    private readonly idGenerator: UlidGenerator,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @OnEvent('ticket.statusChanged')
  async handle(event: StatusChangedEvent): Promise<void> {
    const resolveRecipients = new ResolveNotificationRecipients(this.memberRepository, this.userRepository);
    const users = await resolveRecipients.execute({
      workspaceId: event.workspaceId,
      excludeUserId: event.changedById,
    });
    if (users.length === 0) return;

    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.STATUS_CHANGED,
      title: `${event.ticketName}: ${event.oldStatus} → ${event.newStatus}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppStatusChanged',
      emailPrefKey: 'emailStatusChanged',
    });

    if (emailRecipients.size === 0) return;

    const template = new StatusChangedTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;

    for (const [lang, emails] of emailRecipients) {
      await this.emailService.send({
        to: emails,
        subject: template.subject({ ticketName: event.ticketName, ticketUrl, oldStatus: event.oldStatus, newStatus: event.newStatus, workspaceName: event.workspaceName, lang }),
        html: template.html({ ticketName: event.ticketName, ticketUrl, oldStatus: event.oldStatus, newStatus: event.newStatus, workspaceName: event.workspaceName, lang }),
      });
    }
  }
}
