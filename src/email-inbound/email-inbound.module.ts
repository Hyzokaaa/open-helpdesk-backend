import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TicketModule } from '../ticket/ticket.module';
import { CommentModule } from '../comment/comment.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { EmailRuleModule } from '../email-rule/email-rule.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProjectModule } from '../project/project.module';
import { MailboxImportController } from './infrastructure/nest/controllers/mailbox-import.controller';
import { ImapPollingService } from './infrastructure/imap/imap-polling.service';
import { ProcessedEmailModel } from './infrastructure/typeorm/models/processed-email.model';
import { ProcessedEmailRepository } from './infrastructure/typeorm/repositories/processed-email.repository';

@Module({
  imports: [SharedModule, AuditLogModule, MailboxModule, UserModule, WorkspaceModule, TicketModule, CommentModule, AttachmentModule, EmailRuleModule, OrganizationModule, ProjectModule, TypeOrmModule.forFeature([ProcessedEmailModel])],
  controllers: [MailboxImportController],
  providers: [ImapPollingService, ProcessedEmailRepository],
})
export class EmailInboundModule {}
