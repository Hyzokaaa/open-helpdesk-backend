import { Inject, Injectable } from '@nestjs/common';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { NestEventPublisher } from '../../../../shared/infrastructure/nest-event-publisher';
import { WorkspaceFrontendResolver } from '../../../../shared/infrastructure/workspace-frontend-resolver';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { EMAIL_SERVICE } from '../../../../email/email.constants';
import { EmailService } from '../../../../email/domain/email.service';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { NoticeSender, SendNotice, SendNoticeProps, SentNotice } from '../../../domain/services/notice-send';
import { TypeOrmNotificationRepository } from '../../typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../typeorm/repositories/typeorm-notification-preference.repository';
import { TypeOrmNoticePreferenceRepository } from '../../typeorm/repositories/typeorm-notice-preference.repository';
import { NoticeCatalogProvider } from './notice-catalog.provider';

/**
 * Sends notices that are not about a ticket (NoticeKind): what the core's listeners and an
 * extension (cloud) call. What causes each notice lives with its own listener, never here.
 */
@Injectable()
export class NoticeService implements NoticeSender {
  constructor(
    @Inject() private readonly catalog: NoticeCatalogProvider,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly notificationRepository: TypeOrmNotificationRepository,
    @Inject() private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    @Inject() private readonly noticePreferenceRepository: TypeOrmNoticePreferenceRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly events: NestEventPublisher,
    @Inject() private readonly frontendResolver: WorkspaceFrontendResolver,
  ) {}

  send(props: SendNoticeProps): Promise<SentNotice> {
    return new SendNotice(
      this.catalog.catalog,
      this.idGenerator,
      this.notificationRepository,
      this.preferenceRepository,
      this.noticePreferenceRepository,
      this.userRepository,
      this.memberRepository,
      this.emailService,
      this.auditLogRepository,
      this.events,
      (workspaceId) => (workspaceId ? this.frontendResolver.resolve(workspaceId) : Promise.resolve(this.frontendResolver.installation())),
    ).execute(props);
  }
}
