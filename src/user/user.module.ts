import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AccountModule } from '../account/account.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { UserModel } from './infrastructure/typeorm/models/user.model';
import { TypeOrmUserRepository } from './infrastructure/typeorm/repositories/typeorm-user.repository';
import { AuthController } from './infrastructure/nest/controllers/auth.controller';
import { UserController } from './infrastructure/nest/controllers/user.controller';

@Module({
  imports: [SharedModule, AccountModule, AuditLogModule, forwardRef(() => WorkspaceModule), TypeOrmModule.forFeature([UserModel])],
  controllers: [AuthController, UserController],
  providers: [TypeOrmUserRepository],
  exports: [TypeOrmUserRepository],
})
export class UserModule {}
