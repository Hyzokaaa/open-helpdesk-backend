import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TagModel } from './infrastructure/typeorm/models/tag.model';
import { TypeOrmTagRepository } from './infrastructure/typeorm/repositories/typeorm-tag.repository';
import { TagController } from './infrastructure/nest/controllers/tag.controller';

@Module({
  imports: [SharedModule, WorkspaceModule, TypeOrmModule.forFeature([TagModel])],
  controllers: [TagController],
  providers: [TypeOrmTagRepository],
  exports: [TypeOrmTagRepository],
})
export class TagModule {}
