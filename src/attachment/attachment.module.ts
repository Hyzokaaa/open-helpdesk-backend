import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AttachmentModel } from './infrastructure/typeorm/models/attachment.model';
import { TypeOrmAttachmentRepository } from './infrastructure/typeorm/repositories/typeorm-attachment.repository';
import { AttachmentController } from './infrastructure/nest/controllers/attachment.controller';

@Module({
  imports: [SharedModule, TypeOrmModule.forFeature([AttachmentModel])],
  controllers: [AttachmentController],
  providers: [TypeOrmAttachmentRepository],
  exports: [TypeOrmAttachmentRepository],
})
export class AttachmentModule {}
