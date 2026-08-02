import { Body, Controller, Inject, Logger, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { NestEventPublisher } from '../../../../shared/infrastructure/nest-event-publisher';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { TypeOrmMailboxRepository } from '../../../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmTicketRepository } from '../../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmCommentRepository } from '../../../../comment/infrastructure/typeorm/repositories/typeorm-comment.repository';
import { CreateUser } from '../../../../user/domain/services/user-create';
import { AddWorkspaceMember } from '../../../../workspace/domain/services/workspace-add-member';
import { CreateTicket } from '../../../../ticket/domain/services/ticket-create';
import { CreateComment } from '../../../../comment/domain/services/comment-create';
import { CreateAttachment } from '../../../../attachment/domain/services/attachment-create';
import { TypeOrmAttachmentRepository } from '../../../../attachment/infrastructure/typeorm/repositories/typeorm-attachment.repository';
import { S3StorageService } from '../../../../shared/infrastructure/s3-storage.service';
import { ParseInboundEmail } from '../../../domain/services/parse-inbound-email';
import { RouteInboundEmail } from '../../../domain/services/route-inbound-email';
import { ProcessInboundEmailCommand } from '../../../application/commands/process-inbound-email.command';
import { MtaHookAuthGuard } from '../guards/mta-hook-auth.guard';
import { MtaHookPayload } from '../dto/mta-hook-payload.dto';
import { ProcessedEmailRepository } from '../../typeorm/repositories/processed-email.repository';
import { ConfigService } from '@nestjs/config';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';

@Public()
@Throttle({ default: { ttl: 60000, limit: 300 } })
@UseGuards(MtaHookAuthGuard)
@Controller('inbound')
export class InboundEmailController {
  private readonly logger = new Logger(InboundEmailController.name);
  private readonly emailDomain: string | undefined;

  constructor(
    @Inject() private readonly mailboxRepository: TypeOrmMailboxRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly commentRepository: TypeOrmCommentRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly eventPublisher: NestEventPublisher,
    @Inject() private readonly processedEmailRepository: ProcessedEmailRepository,
    @Inject() private readonly attachmentRepository: TypeOrmAttachmentRepository,
    @Inject() private readonly storageService: S3StorageService,
    @Inject() private readonly config: ConfigService,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {
    this.emailDomain = config.get<string>('EMAIL_DOMAIN');
  }

  @Post('email')
  async handleMtaHook(@Body() payload: MtaHookPayload) {
    if (!this.emailDomain) {
      this.logger.warn('EMAIL_DOMAIN not configured — set it in your .env to enable email-to-ticket');
      return { action: 'accept' };
    }

    try {
      // Idempotency: check Message-ID to avoid duplicates across drivers (MTA Hook + IMAP)
      const messageIdHeader = payload.message?.headers?.find(
        ([name]) => name.toLowerCase() === 'message-id',
      );
      const messageId = messageIdHeader?.[1]?.trim();
      if (messageId) {
        const alreadyProcessed = await this.processedEmailRepository.exists(messageId);
        if (alreadyProcessed) return { action: 'accept' };
      }

      const parser = new ParseInboundEmail(this.emailDomain);
      const createUser = new CreateUser(this.idGenerator, this.userRepository, this.passwordHasher);
      const addMember = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
      const createTicket = new CreateTicket(this.idGenerator, this.ticketRepository);
      const createComment = new CreateComment(this.idGenerator, this.commentRepository);
      const createAttachment = new CreateAttachment(this.idGenerator, this.attachmentRepository, this.storageService);

      const router = new RouteInboundEmail(
        this.mailboxRepository,
        this.userRepository,
        this.memberRepository,
        this.workspaceRepository,
        this.ticketRepository,
        createUser,
        addMember,
        createTicket,
        createComment,
        this.eventPublisher,
        createAttachment,
      );

      const command = new ProcessInboundEmailCommand(parser, router);
      await command.execute({ payload });

      if (messageId) {
        await this.processedEmailRepository.markProcessed(messageId);
      }

      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.INBOUND_EMAIL_PROCESSED,
        entityType: 'email',
        entityId: messageId ?? 'unknown',
        userId: null,
        workspaceId: null,
        metadata: { messageId },
        category: AuditCategory.EMAIL,
        level: AuditLevel.INFO,
        source: 'system',
      }).catch(() => {});
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process inbound email: ${msg}`);
    }

    // Always accept to prevent Stalwart retries and bounce storms
    return { action: 'accept' };
  }
}
