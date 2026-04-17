import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { TicketAssignedTemplate } from '../templates/ticket-assigned.template';
import { TicketAssignedEvent } from '../domain/events';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';

@Injectable()
export class TicketAssignedHandler {
  private readonly logger = new Logger(TicketAssignedHandler.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @OnEvent('ticket.assigned')
  async handle(event: TicketAssignedEvent): Promise<void> {
    const template = new TicketAssignedTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;

    // Notify previous assignee they've been unassigned
    if (event.previousAssigneeId && event.previousAssigneeId !== event.newAssigneeId) {
      const prevUser = await this.userRepository.findById(event.previousAssigneeId);
      if (prevUser) {
        const data = {
          ticketName: event.ticketName,
          ticketUrl,
          workspaceName: event.workspaceName,
        };
        await this.emailService.send({
          to: prevUser.email,
          subject: template.unassignedSubject(data),
          html: template.unassignedHtml(data),
        });
      }
    }

    // Notify new assignee
    if (event.newAssigneeId) {
      const newUser = await this.userRepository.findById(event.newAssigneeId);
      if (newUser) {
        const data = {
          ticketName: event.ticketName,
          ticketUrl,
          assigneeName: `${newUser.firstName} ${newUser.lastName}`,
          workspaceName: event.workspaceName,
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
