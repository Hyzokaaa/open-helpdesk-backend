import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ReportController } from './infrastructure/nest/controllers/report.controller';

@Module({
  imports: [SharedModule, WorkspaceModule],
  controllers: [ReportController],
})
export class ReportModule {}
