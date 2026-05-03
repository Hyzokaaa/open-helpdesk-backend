import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AuditLogEntryModel } from './infrastructure/typeorm/models/audit-log-entry.model';
import { TypeOrmAuditLogRepository } from './infrastructure/typeorm/repositories/typeorm-audit-log.repository';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([AuditLogEntryModel]),
  ],
  providers: [TypeOrmAuditLogRepository],
  exports: [TypeOrmAuditLogRepository],
})
export class AuditLogModule {}
