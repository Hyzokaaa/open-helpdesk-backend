import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AttachmentModel } from './infrastructure/typeorm/models/attachment.model';
import { TypeOrmAttachmentRepository } from './infrastructure/typeorm/repositories/typeorm-attachment.repository';
import { AttachmentController } from './infrastructure/nest/controllers/attachment.controller';
import { StagedUploadCleanupService } from './infrastructure/nest/services/staged-upload-cleanup.service';
import { attachmentUploadOptions } from './infrastructure/nest/attachment-upload-limit';
import { TicketModel } from '../ticket/infrastructure/typeorm/models/ticket.model';
import { TicketParticipantModel } from '../ticket/infrastructure/typeorm/models/ticket-participant.model';
import { CommentModel } from '../comment/infrastructure/typeorm/models/comment.model';
import { TypeOrmTicketRepository } from '../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmTicketParticipantRepository } from '../ticket/infrastructure/typeorm/repositories/typeorm-ticket-participant.repository';
import { TypeOrmCommentRepository } from '../comment/infrastructure/typeorm/repositories/typeorm-comment.repository';

// TicketModule imports this module, so the ticket and comment repositories it needs to check
// access are provided here from their models instead of importing those modules back.
@Module({
  imports: [
    SharedModule,
    AuditLogModule,
    WorkspaceModule,
    MulterModule.registerAsync({ inject: [ConfigService], useFactory: attachmentUploadOptions }),
    TypeOrmModule.forFeature([AttachmentModel, TicketModel, TicketParticipantModel, CommentModel]),
  ],
  controllers: [AttachmentController],
  providers: [
    TypeOrmAttachmentRepository,
    TypeOrmTicketRepository,
    TypeOrmTicketParticipantRepository,
    TypeOrmCommentRepository,
    StagedUploadCleanupService,
  ],
  exports: [TypeOrmAttachmentRepository],
})
export class AttachmentModule {}
