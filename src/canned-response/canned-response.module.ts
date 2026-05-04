import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CannedResponseModel } from './infrastructure/typeorm/models/canned-response.model';
import { TypeOrmCannedResponseRepository } from './infrastructure/typeorm/repositories/typeorm-canned-response.repository';
import { CannedResponseController } from './infrastructure/nest/controllers/canned-response.controller';

@Module({
  imports: [SharedModule, WorkspaceModule, TypeOrmModule.forFeature([CannedResponseModel])],
  controllers: [CannedResponseController],
  providers: [TypeOrmCannedResponseRepository],
  exports: [TypeOrmCannedResponseRepository],
})
export class CannedResponseModule {}
