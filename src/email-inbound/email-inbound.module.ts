import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TicketModule } from '../ticket/ticket.module';
import { CommentModule } from '../comment/comment.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { InboundEmailController } from './infrastructure/nest/controllers/inbound-email.controller';
import { MtaHookAuthGuard } from './infrastructure/nest/guards/mta-hook-auth.guard';
import { ImapPollingService } from './infrastructure/imap/imap-polling.service';
import { ProcessedEmailModel } from './infrastructure/typeorm/models/processed-email.model';
import { ProcessedEmailRepository } from './infrastructure/typeorm/repositories/processed-email.repository';

@Module({
  imports: [SharedModule, MailboxModule, UserModule, WorkspaceModule, TicketModule, CommentModule, AttachmentModule, TypeOrmModule.forFeature([ProcessedEmailModel])],
  controllers: [InboundEmailController],
  providers: [MtaHookAuthGuard, ImapPollingService, ProcessedEmailRepository],
})
export class EmailInboundModule {}
