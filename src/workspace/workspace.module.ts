import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
// Note: circular dependency with UserModule — both use forwardRef
import { AccountModule } from '../account/account.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { ProjectModule } from '../project/project.module';
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
import { WorkspaceCreationSettingsController } from './infrastructure/nest/controllers/workspace-creation-settings.controller';
import { WorkspaceCreationSettingsModel } from './infrastructure/typeorm/models/workspace-creation-settings.model';
import { TypeOrmWorkspaceCreationSettingsRepository } from './infrastructure/typeorm/repositories/typeorm-workspace-creation-settings.repository';
import { WorkspaceFrontendResolver } from '../shared/infrastructure/workspace-frontend-resolver';

@Module({
  imports: [
    SharedModule,
    forwardRef(() => UserModule),
    AccountModule,
    AuditLogModule,
    MailboxModule,
    forwardRef(() => ProjectModule),
    TypeOrmModule.forFeature([WorkspaceModel, WorkspaceMemberModel, WorkspaceInvitationModel, WorkspaceEmailSenderModel, WorkspaceCreationSettingsModel]),
  ],
  controllers: [WorkspaceController, WorkspaceInvitationController, WorkspaceImportController, InvitationPublicController, DomainCheckController, WorkspaceCreationSettingsController],
  providers: [TypeOrmWorkspaceRepository, TypeOrmWorkspaceMemberRepository, TypeOrmWorkspaceInvitationRepository, TypeOrmWorkspaceEmailSenderRepository, TypeOrmWorkspaceCreationSettingsRepository, WorkspaceFrontendResolver],
  exports: [TypeOrmWorkspaceRepository, TypeOrmWorkspaceMemberRepository, TypeOrmWorkspaceInvitationRepository, TypeOrmWorkspaceEmailSenderRepository, TypeOrmWorkspaceCreationSettingsRepository, WorkspaceFrontendResolver],
})
export class WorkspaceModule {}
