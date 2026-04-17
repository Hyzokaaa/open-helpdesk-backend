import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TicketModule } from '../ticket/ticket.module';
import { CommentModel } from './infrastructure/typeorm/models/comment.model';
import { TypeOrmCommentRepository } from './infrastructure/typeorm/repositories/typeorm-comment.repository';
import { CommentController } from './infrastructure/nest/controllers/comment.controller';

@Module({
  imports: [
    SharedModule,
    UserModule,
    WorkspaceModule,
    TicketModule,
    TypeOrmModule.forFeature([CommentModel]),
  ],
  controllers: [CommentController],
  providers: [TypeOrmCommentRepository],
  exports: [TypeOrmCommentRepository],
})
export class CommentModule {}
