import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
// Note: circular dependency with UserModule — both use forwardRef
import { AccountModule } from '../account/account.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { WorkspaceModel } from './infrastructure/typeorm/models/workspace.model';
import { WorkspaceMemberModel } from './infrastructure/typeorm/models/workspace-member.model';
import { WorkspaceInvitationModel } from './infrastructure/typeorm/models/workspace-invitation.model';
import { TypeOrmWorkspaceRepository } from './infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from './infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceInvitationRepository } from './infrastructure/typeorm/repositories/typeorm-workspace-invitation.repository';
import { WorkspaceEmailSenderModel } from './infrastructure/typeorm/models/workspace-email-sender.model';
import { TypeOrmWorkspaceEmailSenderRepository } from './infrastructure/typeorm/repositories/typeorm-workspace-email-sender.repository';
import { WorkspaceController } from './infrastructure/nest/controllers/workspace.controller';
import { WorkspaceInvitationController } from './infrastructure/nest/controllers/workspace-invitation.controller';
import { WorkspaceImportController } from './infrastructure/nest/controllers/workspace-import.controller';
import { InvitationPublicController } from './infrastructure/nest/controllers/invitation-public.controller';
import { DomainCheckController } from './infrastructure/nest/controllers/domain-check.controller';

@Module({
  imports: [
    SharedModule,
    forwardRef(() => UserModule),
    AccountModule,
    AuditLogModule,
    MailboxModule,
    TypeOrmModule.forFeature([WorkspaceModel, WorkspaceMemberModel, WorkspaceInvitationModel, WorkspaceEmailSenderModel]),
  ],
  controllers: [WorkspaceController, WorkspaceInvitationController, WorkspaceImportController, InvitationPublicController, DomainCheckController],
  providers: [TypeOrmWorkspaceRepository, TypeOrmWorkspaceMemberRepository, TypeOrmWorkspaceInvitationRepository, TypeOrmWorkspaceEmailSenderRepository],
  exports: [TypeOrmWorkspaceRepository, TypeOrmWorkspaceMemberRepository, TypeOrmWorkspaceInvitationRepository, TypeOrmWorkspaceEmailSenderRepository],
})
export class WorkspaceModule {}
