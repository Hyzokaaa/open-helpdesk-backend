import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService, SendEmailResult } from '../domain/email.service';
import { TypeOrmAuditLogRepository } from '../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { RecordEmailSend } from '../../audit-log/domain/services/audit-log-record-email-send';
import { UlidGenerator } from '../../shared/infrastructure/ulid-generator';
import { connectionErrorDetail } from '../../shared/infrastructure/connection-error-detail';
import { EMAIL_SERVICE } from '../email.constants';
import { CustomDomainCheckEvent } from '../domain/events';
import { CustomDomainCheckKind, CustomDomainCheckTemplate } from '../templates/custom-domain-check.template';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';

/**
 * Tells a workspace's admins when the daily check finds its custom domain no longer pointing to
 * the installation: once when it starts failing, and again when sessions stop being handed over.
 */
@Injectable()
export class CustomDomainCheckHandler {
  private readonly logger = new Logger(CustomDomainCheckHandler.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    config: ConfigService,
    private readonly auditLogRepository: TypeOrmAuditLogRepository,
    private readonly idGenerator: UlidGenerator,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @OnEvent('workspace.custom-domain-failing')
  async onFailing(event: CustomDomainCheckEvent): Promise<void> {
    await this.notify('failing', event);
  }

  @OnEvent('workspace.custom-domain-distrusted')
  async onDistrusted(event: CustomDomainCheckEvent): Promise<void> {
    await this.notify('distrusted', event);
  }

  private async notify(kind: CustomDomainCheckKind, event: CustomDomainCheckEvent): Promise<void> {
    try {
      const adminIds = (await this.memberRepository.findByWorkspaceId(event.workspaceId))
        .filter((m) => m.role === WorkspaceRole.ADMIN)
        .map((m) => m.userId);
      if (adminIds.length === 0) return;

      const template = new CustomDomainCheckTemplate();
      for (const user of (await this.userRepository.findByIds(adminIds)).filter((u) => u.isActive)) {
        const lang = user.language ?? 'en';
        const data = {
          kind,
          workspaceName: event.workspaceName,
          domain: event.domain,
          failingSince: new Date(event.failingSince).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          // On the installation's own address: the custom domain may be the thing that is broken
          settingsUrl: `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/settings`,
          lang,
        };
        const subject = template.subject(data);
        let result: SendEmailResult;
        try {
          result = await this.emailService.send({ to: user.email, subject, html: template.html(data) });
        } catch (err) {
          result = { success: false, error: connectionErrorDetail(err) };
        }
        await new RecordEmailSend(this.idGenerator, this.auditLogRepository).execute({
          result, type: `custom-domain-${kind}`, to: user.email, subject, workspaceId: event.workspaceId, entityType: 'workspace', entityId: event.workspaceId,
        });
      }
    } catch (err) {
      this.logger.error(`Custom domain ${kind} email for ${event.workspaceId} failed: ${(err as Error).message}`);
    }
  }
}
