import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { NotificationModule } from './notification.module';
import { NoticePreferenceModel } from './infrastructure/typeorm/models/notice-preference.model';
import { TypeOrmNoticePreferenceRepository } from './infrastructure/typeorm/repositories/typeorm-notice-preference.repository';
import { NoticePreferenceController } from './infrastructure/nest/controllers/notice-preference.controller';
import { NoticeService } from './infrastructure/nest/services/notice.service';
import { MembersJoinedNoticeListener } from './infrastructure/nest/services/members-joined-notice.listener';

/**
 * Notices that are not about a ticket (NoticeKind). Apart from NotificationModule because they
 * need the workspaces and users, whose modules import that one. An extension sends its own with
 * NoticeService.
 */
@Module({
  imports: [
    SharedModule,
    AuditLogModule,
    UserModule,
    WorkspaceModule,
    NotificationModule,
    TypeOrmModule.forFeature([NoticePreferenceModel]),
  ],
  controllers: [NoticePreferenceController],
  providers: [TypeOrmNoticePreferenceRepository, NoticeService, MembersJoinedNoticeListener],
  exports: [NoticeService],
})
export class NoticeModule {}
