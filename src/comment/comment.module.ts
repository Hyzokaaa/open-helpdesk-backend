import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TicketModule } from '../ticket/ticket.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { CommentModel } from './infrastructure/typeorm/models/comment.model';
import { CommentEditModel } from './infrastructure/typeorm/models/comment-edit.model';
import { TypeOrmCommentRepository } from './infrastructure/typeorm/repositories/typeorm-comment.repository';
import { TypeOrmCommentEditRepository } from './infrastructure/typeorm/repositories/typeorm-comment-edit.repository';
import { CommentController } from './infrastructure/nest/controllers/comment.controller';

@Module({
  imports: [
    SharedModule,
    UserModule,
    WorkspaceModule,
    TicketModule,
    AuditLogModule,
    AttachmentModule,
    TypeOrmModule.forFeature([CommentModel, CommentEditModel]),
  ],
  controllers: [CommentController],
  providers: [TypeOrmCommentRepository, TypeOrmCommentEditRepository],
  exports: [TypeOrmCommentRepository, TypeOrmCommentEditRepository],
})
export class CommentModule {}
