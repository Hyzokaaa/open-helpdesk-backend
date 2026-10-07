import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AuditLogEntryModel } from './infrastructure/typeorm/models/audit-log-entry.model';
import { TypeOrmAuditLogRepository } from './infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { AuditRetentionSettingsModel } from './infrastructure/typeorm/models/audit-retention-settings.model';
import { WorkspaceAuditRetentionModel } from './infrastructure/typeorm/models/workspace-audit-retention.model';
import { TypeOrmAuditRetentionSettingsRepository } from './infrastructure/typeorm/repositories/typeorm-audit-retention-settings.repository';
import { TypeOrmWorkspaceAuditRetentionRepository } from './infrastructure/typeorm/repositories/typeorm-workspace-audit-retention.repository';
import { AuditRetentionScheduler } from './infrastructure/nest/audit-retention.scheduler';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([AuditLogEntryModel, AuditRetentionSettingsModel, WorkspaceAuditRetentionModel]),
  ],
  providers: [TypeOrmAuditLogRepository, TypeOrmAuditRetentionSettingsRepository, TypeOrmWorkspaceAuditRetentionRepository, AuditRetentionScheduler],
  exports: [TypeOrmAuditLogRepository, TypeOrmAuditRetentionSettingsRepository, TypeOrmWorkspaceAuditRetentionRepository],
})
export class AuditLogModule {}
