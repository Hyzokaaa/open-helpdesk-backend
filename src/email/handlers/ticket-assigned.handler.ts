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
import { Notification } from '../../notification/domain/entities/notification';
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

    // Unassigned notification to previous assignee
    if (event.previousAssigneeId && event.previousAssigneeId !== event.newAssigneeId) {
      const prevUser = await this.userRepository.findById(event.previousAssigneeId);
      if (prevUser) {
        const pref = (await this.preferenceRepository.findByUserIds([prevUser.getId()])).get(prevUser.getId());

        if (!pref || (pref.inAppEnabled && pref.inAppTicketAssigned)) {
          await this.notificationRepository.create(
            new Notification({
              id: this.idGenerator.create(),
              userId: prevUser.getId(),
              type: NotificationType.TICKET_ASSIGNED,
              title: `Unassigned: ${event.ticketName}`,
              ticketId: event.ticketId,
              workspaceSlug: event.workspaceSlug,
              isRead: false,
            }),
          );
        }

        if (!pref || (pref.emailEnabled && pref.emailTicketAssigned)) {
          const lang = prevUser.language || 'en';
          const data = { ticketName: event.ticketName, ticketUrl, workspaceName: event.workspaceName, lang };
          await this.emailService.send({
            to: prevUser.email,
            subject: template.unassignedSubject(data),
            html: template.unassignedHtml(data),
          });
        }
      }
    }

    // Assigned notification to new assignee
    if (event.newAssigneeId) {
      const newUser = await this.userRepository.findById(event.newAssigneeId);
      if (newUser) {
        const pref = (await this.preferenceRepository.findByUserIds([newUser.getId()])).get(newUser.getId());

        if (!pref || (pref.inAppEnabled && pref.inAppTicketAssigned)) {
          await this.notificationRepository.create(
            new Notification({
              id: this.idGenerator.create(),
              userId: newUser.getId(),
              type: NotificationType.TICKET_ASSIGNED,
              title: `Assigned: ${event.ticketName}`,
              ticketId: event.ticketId,
              workspaceSlug: event.workspaceSlug,
              isRead: false,
            }),
          );
        }

        if (!pref || (pref.emailEnabled && pref.emailTicketAssigned)) {
          const lang = newUser.language || 'en';
          const data = {
            ticketName: event.ticketName,
            ticketUrl,
            assigneeName: `${newUser.firstName} ${newUser.lastName}`,
            workspaceName: event.workspaceName,
            lang,
          };
          await this.emailService.send({
            to: newUser.email,
            subject: template.assignedSubject(data),
            html: template.assignedHtml(data),
          });
        }
      }
    }
  }
}
