import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { NewCommentTemplate } from '../templates/new-comment.template';
import { NewCommentEvent } from '../domain/events';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';

@Injectable()
export class NewCommentHandler {
  private readonly logger = new Logger(NewCommentHandler.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @OnEvent('comment.created')
  async handle(event: NewCommentEvent): Promise<void> {
    const recipientIds = new Set<string>();

    if (event.assigneeId && event.assigneeId !== event.authorId) {
      recipientIds.add(event.assigneeId);
    }
    for (const userId of event.mentionedUserIds) {
      if (userId !== event.authorId) recipientIds.add(userId);
    }
    if (recipientIds.size === 0) return;

    const users = await this.userRepository.findByIds([...recipientIds]);
    if (users.length === 0) return;

    const cleanContent = event.commentContent.replace(
      /@\[([^\]]+)\]\([^)]+\)/g,
      '@$1',
    );
    const preview = cleanContent.length > 200
      ? cleanContent.substring(0, 200) + '...'
      : cleanContent;

    const template = new NewCommentTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;

    const byLang = new Map<string, string[]>();
    for (const u of users) {
      const lang = u.language || 'en';
      if (!byLang.has(lang)) byLang.set(lang, []);
      byLang.get(lang)!.push(u.email);
    }

    for (const [lang, emails] of byLang) {
      const data = {
        ticketName: event.ticketName,
        ticketUrl,
        authorName: event.authorName,
        commentPreview: preview,
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
