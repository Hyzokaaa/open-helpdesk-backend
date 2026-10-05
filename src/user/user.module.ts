import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AccountModule } from '../account/account.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { UserModel } from './infrastructure/typeorm/models/user.model';
import { UserSessionModel } from './infrastructure/typeorm/models/user-session.model';
import { UsedTokenModel } from './infrastructure/typeorm/models/used-token.model';
import { TypeOrmUserRepository } from './infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmUserSessionRepository } from './infrastructure/typeorm/repositories/typeorm-user-session.repository';
import { TypeOrmUsedTokenRepository } from './infrastructure/typeorm/repositories/typeorm-used-token.repository';
import { AuthController } from './infrastructure/nest/controllers/auth.controller';
import { UserController } from './infrastructure/nest/controllers/user.controller';
import { SessionCleanupScheduler } from './infrastructure/nest/services/session-cleanup.scheduler';

@Module({
  imports: [SharedModule, AccountModule, AuditLogModule, forwardRef(() => WorkspaceModule), TypeOrmModule.forFeature([UserModel, UserSessionModel, UsedTokenModel])],
  controllers: [AuthController, UserController],
  providers: [TypeOrmUserRepository, TypeOrmUserSessionRepository, TypeOrmUsedTokenRepository, SessionCleanupScheduler],
  exports: [TypeOrmUserRepository, TypeOrmUserSessionRepository],
})
export class UserModule {}
