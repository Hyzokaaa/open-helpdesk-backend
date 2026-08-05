import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CustomFieldDefinitionModel } from './infrastructure/typeorm/models/custom-field-definition.model';
import { TypeOrmCustomFieldDefinitionRepository } from './infrastructure/typeorm/repositories/typeorm-custom-field-definition.repository';
import { CustomFieldDefinitionController } from './infrastructure/nest/controllers/custom-field-definition.controller';

@Module({
  imports: [SharedModule, WorkspaceModule, AuditLogModule, TypeOrmModule.forFeature([CustomFieldDefinitionModel])],
  controllers: [CustomFieldDefinitionController],
  providers: [TypeOrmCustomFieldDefinitionRepository],
  exports: [TypeOrmCustomFieldDefinitionRepository],
})
export class CustomFieldModule {}
