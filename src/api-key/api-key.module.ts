import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ApiKeyModel } from './infrastructure/typeorm/models/api-key.model';
import { TypeOrmApiKeyRepository } from './infrastructure/typeorm/repositories/typeorm-api-key.repository';
import { ApiKeyController } from './infrastructure/nest/controllers/api-key.controller';

@Module({
  imports: [
    SharedModule,
    WorkspaceModule,
    TypeOrmModule.forFeature([ApiKeyModel]),
  ],
  controllers: [ApiKeyController],
  providers: [TypeOrmApiKeyRepository],
  exports: [TypeOrmApiKeyRepository],
})
export class ApiKeyModule {}
