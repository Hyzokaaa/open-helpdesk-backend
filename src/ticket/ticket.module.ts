import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CustomFieldModule } from '../custom-field/custom-field.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { TicketModel } from './infrastructure/typeorm/models/ticket.model';
import { TypeOrmTicketRepository } from './infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TicketController } from './infrastructure/nest/controllers/ticket.controller';

@Module({
  imports: [SharedModule, UserModule, WorkspaceModule, AuditLogModule, CustomFieldModule, AttachmentModule, TypeOrmModule.forFeature([TicketModel])],
  controllers: [TicketController],
  providers: [TypeOrmTicketRepository],
  exports: [TypeOrmTicketRepository],
})
export class TicketModule {}
