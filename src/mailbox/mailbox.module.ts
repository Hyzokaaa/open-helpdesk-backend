import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EmailInboundModule } from '../email-inbound/email-inbound.module';
import { MailboxModel } from './infrastructure/typeorm/models/mailbox.model';
import { TypeOrmMailboxRepository } from './infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { MailboxController } from './infrastructure/nest/controllers/mailbox.controller';

@Module({
  imports: [SharedModule, forwardRef(() => WorkspaceModule), AuditLogModule, forwardRef(() => EmailInboundModule), TypeOrmModule.forFeature([MailboxModel])],
  controllers: [MailboxController],
  providers: [TypeOrmMailboxRepository],
  exports: [TypeOrmMailboxRepository],
})
export class MailboxModule {}
