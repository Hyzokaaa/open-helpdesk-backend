import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { StatusChangedTemplate } from '../templates/status-changed.template';
import { StatusChangedEvent } from '../domain/events';
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';

@Injectable()
export class StatusChangedHandler {
  private readonly logger = new Logger(StatusChangedHandler.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @OnEvent('ticket.statusChanged')
  async handle(event: StatusChangedEvent): Promise<void> {
    const members = await this.memberRepository.findByWorkspaceId(event.workspaceId);
    const agentMembers = members.filter(
      (m) => m.role === WorkspaceRole.ADMIN || m.role === WorkspaceRole.AGENT,
    );

    if (agentMembers.length === 0) return;

    const users = await this.userRepository.findByIds(
      agentMembers.map((m) => m.userId),
    );

    const template = new StatusChangedTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;

    const data = {
      ticketName: event.ticketName,
      ticketUrl,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
      workspaceName: event.workspaceName,
    };

    const result = await this.emailService.send({
      to: users.map((u) => u.email),
      subject: template.subject(data),
      html: template.html(data),
    });

    if (!result.success) {
      this.logger.error(`Failed to send status change email for ${event.ticketId}`);
    }
  }
}
