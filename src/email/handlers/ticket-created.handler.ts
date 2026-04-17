import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { TicketCreatedTemplate } from '../templates/ticket-created.template';
import { TicketCreatedEvent } from '../domain/events';
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';

@Injectable()
export class TicketCreatedHandler {
  private readonly logger = new Logger(TicketCreatedHandler.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @OnEvent('ticket.created')
  async handle(event: TicketCreatedEvent): Promise<void> {
    const members = await this.memberRepository.findByWorkspaceId(event.workspaceId);
    const agentMembers = members.filter(
      (m) => m.role === WorkspaceRole.ADMIN || m.role === WorkspaceRole.AGENT,
    );

    if (agentMembers.length === 0) return;

    const users = await this.userRepository.findByIds(
      agentMembers.map((m) => m.userId),
    );

    const emails = users.map((u) => u.email);
    const template = new TicketCreatedTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;

    const data = {
      ticketName: event.ticketName,
      ticketUrl,
      creatorName: event.creatorName,
      priority: event.priority,
      category: event.category,
      workspaceName: event.workspaceName,
    };

    const result = await this.emailService.send({
      to: emails,
      subject: template.subject(data),
      html: template.html(data),
    });

    if (!result.success) {
      this.logger.error(`Failed to send ticket created email for ${event.ticketId}`);
    }
  }
}
