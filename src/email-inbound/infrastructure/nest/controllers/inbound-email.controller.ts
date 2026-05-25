import { Body, Controller, Inject, Logger, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
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
import { ParseInboundEmail } from '../../../domain/services/parse-inbound-email';
import { RouteInboundEmail } from '../../../domain/services/route-inbound-email';
import { ProcessInboundEmailCommand } from '../../../application/commands/process-inbound-email.command';
import { MtaHookAuthGuard } from '../guards/mta-hook-auth.guard';
import { MtaHookPayload } from '../dto/mta-hook-payload.dto';
import { ConfigService } from '@nestjs/config';

@Public()
@SkipThrottle()
@UseGuards(MtaHookAuthGuard)
@Controller('inbound')
export class InboundEmailController {
  private readonly logger = new Logger(InboundEmailController.name);
  private readonly emailDomain: string;

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
    @Inject() private readonly config: ConfigService,
  ) {
    this.emailDomain = config.getOrThrow<string>('EMAIL_DOMAIN');
  }

  @Post('email')
  async handleMtaHook(@Body() payload: MtaHookPayload) {
    try {
      const parser = new ParseInboundEmail(this.emailDomain);
      const createUser = new CreateUser(this.idGenerator, this.userRepository, this.passwordHasher);
      const addMember = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
      const createTicket = new CreateTicket(this.idGenerator, this.ticketRepository);
      const createComment = new CreateComment(this.idGenerator, this.commentRepository);

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
      );

      const command = new ProcessInboundEmailCommand(parser, router);
      await command.execute({ payload });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process inbound email: ${msg}`);
    }

    // Always accept to prevent Stalwart retries and bounce storms
    return { action: 'accept' };
  }
}
