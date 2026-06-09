import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ReportController } from './infrastructure/nest/controllers/report.controller';

@Module({
  imports: [SharedModule, UserModule, WorkspaceModule],
  controllers: [ReportController],
})
export class ReportModule {}
