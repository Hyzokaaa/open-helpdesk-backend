import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModel } from './infrastructure/typeorm/models/workspace.model';
import { WorkspaceMemberModel } from './infrastructure/typeorm/models/workspace-member.model';
import { TypeOrmWorkspaceRepository } from './infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from './infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { WorkspaceController } from './infrastructure/nest/controllers/workspace.controller';

@Module({
  imports: [
    SharedModule,
    UserModule,
    TypeOrmModule.forFeature([WorkspaceModel, WorkspaceMemberModel]),
  ],
  controllers: [WorkspaceController],
  providers: [TypeOrmWorkspaceRepository, TypeOrmWorkspaceMemberRepository],
  exports: [TypeOrmWorkspaceRepository, TypeOrmWorkspaceMemberRepository],
})
export class WorkspaceModule {}
