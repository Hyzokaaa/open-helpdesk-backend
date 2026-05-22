import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { AccountModule } from '../account/account.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { WorkspaceModel } from './infrastructure/typeorm/models/workspace.model';
import { WorkspaceMemberModel } from './infrastructure/typeorm/models/workspace-member.model';
import { WorkspaceInvitationModel } from './infrastructure/typeorm/models/workspace-invitation.model';
import { TypeOrmWorkspaceRepository } from './infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from './infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceInvitationRepository } from './infrastructure/typeorm/repositories/typeorm-workspace-invitation.repository';
import { WorkspaceController } from './infrastructure/nest/controllers/workspace.controller';
import { WorkspaceInvitationController } from './infrastructure/nest/controllers/workspace-invitation.controller';
import { InvitationPublicController } from './infrastructure/nest/controllers/invitation-public.controller';

@Module({
  imports: [
    SharedModule,
    UserModule,
    AccountModule,
    AuditLogModule,
    MailboxModule,
    TypeOrmModule.forFeature([WorkspaceModel, WorkspaceMemberModel, WorkspaceInvitationModel]),
  ],
  controllers: [WorkspaceController, WorkspaceInvitationController, InvitationPublicController],
  providers: [TypeOrmWorkspaceRepository, TypeOrmWorkspaceMemberRepository, TypeOrmWorkspaceInvitationRepository],
  exports: [TypeOrmWorkspaceRepository, TypeOrmWorkspaceMemberRepository, TypeOrmWorkspaceInvitationRepository],
})
export class WorkspaceModule {}
