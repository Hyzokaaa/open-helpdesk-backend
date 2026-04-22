import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { TicketCreatedTemplate } from '../templates/ticket-created.template';
import { TicketCreatedEvent } from '../domain/events';
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmNotificationRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification-preference.repository';
import { UlidGenerator } from '../../shared/infrastructure/ulid-generator';
import { ResolveNotificationRecipients } from '../../notification/domain/services/notification-resolve-recipients';
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';

@Injectable()
export class TicketCreatedHandler {
  private readonly logger = new Logger(TicketCreatedHandler.name);
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

  @OnEvent('ticket.created')
  async handle(event: TicketCreatedEvent): Promise<void> {
    const resolveRecipients = new ResolveNotificationRecipients(this.memberRepository, this.userRepository);
    const users = await resolveRecipients.execute({
      workspaceId: event.workspaceId,
      excludeUserId: event.creatorId,
    });
    if (users.length === 0) return;

    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.TICKET_CREATED,
      title: `${event.creatorName}: ${event.ticketName}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppTicketCreated',
      emailPrefKey: 'emailTicketCreated',
    });

    if (emailRecipients.size === 0) return;

    const template = new TicketCreatedTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;

    for (const [lang, emails] of emailRecipients) {
      await this.emailService.send({
        to: emails,
        subject: template.subject({ ticketName: event.ticketName, ticketUrl, creatorName: event.creatorName, priority: event.priority, category: event.category, workspaceName: event.workspaceName, lang }),
        html: template.html({ ticketName: event.ticketName, ticketUrl, creatorName: event.creatorName, priority: event.priority, category: event.category, workspaceName: event.workspaceName, lang }),
      });
    }
  }
}
