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
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';
import { Notification } from '../../notification/domain/entities/notification';
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
    const members = await this.memberRepository.findByWorkspaceId(event.workspaceId);
    const agentMembers = members.filter(
      (m) => m.role === WorkspaceRole.ADMIN || m.role === WorkspaceRole.AGENT,
    );
    if (agentMembers.length === 0) return;

    const allUsers = await this.userRepository.findByIds(agentMembers.map((m) => m.userId));
    const users = allUsers.filter((u) => u.getId() !== event.changedById);
    if (users.length === 0) return;

    const userIds = users.map((u) => u.getId());
    const prefs = await this.preferenceRepository.findByUserIds(userIds);

    // In-app notifications
    for (const user of users) {
      const pref = prefs.get(user.getId());
      if (!pref || (pref.inAppEnabled && pref.inAppStatusChanged)) {
        await this.notificationRepository.create(
          new Notification({
            id: this.idGenerator.create(),
            userId: user.getId(),
            type: NotificationType.STATUS_CHANGED,
            title: `${event.ticketName}: ${event.oldStatus} → ${event.newStatus}`,
            ticketId: event.ticketId,
            workspaceSlug: event.workspaceSlug,
            isRead: false,
          }),
        );
      }
    }

    // Email notifications
    const emailUsers = users.filter((u) => {
      const pref = prefs.get(u.getId());
      return !pref || (pref.emailEnabled && pref.emailStatusChanged);
    });
    if (emailUsers.length === 0) return;

    const template = new StatusChangedTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;

    const byLang = new Map<string, string[]>();
    for (const u of emailUsers) {
      const lang = u.language || 'en';
      if (!byLang.has(lang)) byLang.set(lang, []);
      byLang.get(lang)!.push(u.email);
    }

    for (const [lang, emails] of byLang) {
      const data = {
        ticketName: event.ticketName,
        ticketUrl,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        workspaceName: event.workspaceName,
        lang,
      };

      await this.emailService.send({
        to: emails,
        subject: template.subject(data),
        html: template.html(data),
      });
    }
  }
}
