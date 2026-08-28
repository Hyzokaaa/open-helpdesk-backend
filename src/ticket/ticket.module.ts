import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CustomFieldModule } from '../custom-field/custom-field.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { DepartmentModule } from '../department/department.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProjectModule } from '../project/project.module';
import { TicketModel } from './infrastructure/typeorm/models/ticket.model';
import { TicketParticipantModel } from './infrastructure/typeorm/models/ticket-participant.model';
import { TransferRequestModel } from './infrastructure/typeorm/models/transfer-request.model';
import { CommentModel } from '../comment/infrastructure/typeorm/models/comment.model';
import { TypeOrmTicketRepository } from './infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmTicketParticipantRepository } from './infrastructure/typeorm/repositories/typeorm-ticket-participant.repository';
import { TypeOrmTransferRequestRepository } from './infrastructure/typeorm/repositories/typeorm-transfer-request.repository';
import { TypeOrmCommentRepository } from '../comment/infrastructure/typeorm/repositories/typeorm-comment.repository';
import { TicketController } from './infrastructure/nest/controllers/ticket.controller';
import { PortalController } from './infrastructure/nest/controllers/portal.controller';
import { SlaBreachCheckerService } from './infrastructure/nest/services/sla-breach-checker.service';
import { TransferRequestExpiryService } from './infrastructure/nest/services/transfer-request-expiry.service';

@Module({
  imports: [SharedModule, UserModule, WorkspaceModule, AuditLogModule, CustomFieldModule, AttachmentModule, DepartmentModule, OrganizationModule, ProjectModule, TypeOrmModule.forFeature([TicketModel, TicketParticipantModel, TransferRequestModel, CommentModel])],
  controllers: [TicketController, PortalController],
  providers: [TypeOrmTicketRepository, TypeOrmTicketParticipantRepository, TypeOrmTransferRequestRepository, TypeOrmCommentRepository, SlaBreachCheckerService, TransferRequestExpiryService],
  exports: [TypeOrmTicketRepository, TypeOrmTicketParticipantRepository, TypeOrmTransferRequestRepository],
})
export class TicketModule {}
