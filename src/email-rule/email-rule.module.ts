import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailRuleModel } from './infrastructure/typeorm/models/email-rule.model';
import { TypeOrmEmailRuleRepository } from './infrastructure/typeorm/repositories/typeorm-email-rule.repository';
import { EmailRuleController } from './infrastructure/nest/controllers/email-rule.controller';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailRuleModel]),
    SharedModule,
    WorkspaceModule,
  ],
  controllers: [EmailRuleController],
  providers: [TypeOrmEmailRuleRepository],
  exports: [TypeOrmEmailRuleRepository],
})
export class EmailRuleModule {}
