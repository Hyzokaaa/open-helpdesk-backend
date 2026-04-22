import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { TicketAssignedTemplate } from '../templates/ticket-assigned.template';
import { TicketAssignedEvent } from '../domain/events';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmNotificationRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification-preference.repository';
import { UlidGenerator } from '../../shared/infrastructure/ulid-generator';
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';

@Injectable()
export class TicketAssignedHandler {
  private readonly logger = new Logger(TicketAssignedHandler.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly notificationRepository: TypeOrmNotificationRepository,
    private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    private readonly idGenerator: UlidGenerator,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @OnEvent('ticket.assigned')
  async handle(event: TicketAssignedEvent): Promise<void> {
    const template = new TicketAssignedTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;
    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);

    // Unassigned — notify previous assignee
    if (event.previousAssigneeId && event.previousAssigneeId !== event.newAssigneeId) {
      const prevUsers = await this.userRepository.findByIds([event.previousAssigneeId]);
      if (prevUsers.length > 0) {
        const { emailRecipients } = await dispatch.execute({
          users: prevUsers,
          type: NotificationType.TICKET_ASSIGNED,
          title: `Unassigned: ${event.ticketName}`,
          ticketId: event.ticketId,
          workspaceSlug: event.workspaceSlug,
          inAppPrefKey: 'inAppTicketAssigned',
          emailPrefKey: 'emailTicketAssigned',
        });

        for (const [lang, emails] of emailRecipients) {
          const data = { ticketName: event.ticketName, ticketUrl, workspaceName: event.workspaceName, lang };
          await this.emailService.send({
            to: emails,
            subject: template.unassignedSubject(data),
            html: template.unassignedHtml(data),
          });
        }
      }
    }

    // Assigned — notify new assignee
    if (event.newAssigneeId) {
      const newUsers = await this.userRepository.findByIds([event.newAssigneeId]);
      if (newUsers.length > 0) {
        const { emailRecipients } = await dispatch.execute({
          users: newUsers,
          type: NotificationType.TICKET_ASSIGNED,
          title: `Assigned: ${event.ticketName}`,
          ticketId: event.ticketId,
          workspaceSlug: event.workspaceSlug,
          inAppPrefKey: 'inAppTicketAssigned',
          emailPrefKey: 'emailTicketAssigned',
        });

        for (const [lang, emails] of emailRecipients) {
          const data = {
            ticketName: event.ticketName,
            ticketUrl,
            assigneeName: `${newUsers[0].firstName} ${newUsers[0].lastName}`,
            workspaceName: event.workspaceName,
            lang,
          };
          await this.emailService.send({
            to: emails,
            subject: template.assignedSubject(data),
            html: template.assignedHtml(data),
          });
        }
      }
    }
  }
}
