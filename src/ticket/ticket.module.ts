import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CustomFieldModule } from '../custom-field/custom-field.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { TicketModel } from './infrastructure/typeorm/models/ticket.model';
import { CommentModel } from '../comment/infrastructure/typeorm/models/comment.model';
import { TypeOrmTicketRepository } from './infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmCommentRepository } from '../comment/infrastructure/typeorm/repositories/typeorm-comment.repository';
import { TicketController } from './infrastructure/nest/controllers/ticket.controller';
import { PortalController } from './infrastructure/nest/controllers/portal.controller';
import { SlaBreachCheckerService } from './infrastructure/nest/services/sla-breach-checker.service';

@Module({
  imports: [SharedModule, UserModule, WorkspaceModule, AuditLogModule, CustomFieldModule, AttachmentModule, TypeOrmModule.forFeature([TicketModel, CommentModel])],
  controllers: [TicketController, PortalController],
  providers: [TypeOrmTicketRepository, TypeOrmCommentRepository, SlaBreachCheckerService],
  exports: [TypeOrmTicketRepository],
})
export class TicketModule {}
