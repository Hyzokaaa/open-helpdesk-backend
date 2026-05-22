import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TicketModule } from '../ticket/ticket.module';
import { CommentModule } from '../comment/comment.module';
import { InboundEmailController } from './infrastructure/nest/controllers/inbound-email.controller';
import { MtaHookAuthGuard } from './infrastructure/nest/guards/mta-hook-auth.guard';

@Module({
  imports: [SharedModule, MailboxModule, UserModule, WorkspaceModule, TicketModule, CommentModule],
  controllers: [InboundEmailController],
  providers: [MtaHookAuthGuard],
})
export class EmailInboundModule {}
