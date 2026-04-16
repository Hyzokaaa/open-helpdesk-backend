import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { CommentModel } from './infrastructure/typeorm/models/comment.model';
import { TypeOrmCommentRepository } from './infrastructure/typeorm/repositories/typeorm-comment.repository';
import { CommentController } from './infrastructure/nest/controllers/comment.controller';

@Module({
  imports: [SharedModule, TypeOrmModule.forFeature([CommentModel])],
  controllers: [CommentController],
  providers: [TypeOrmCommentRepository],
  exports: [TypeOrmCommentRepository],
})
export class CommentModule {}
