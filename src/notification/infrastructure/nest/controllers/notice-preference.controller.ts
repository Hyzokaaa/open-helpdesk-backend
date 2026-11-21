import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { GetNoticePreferencesQuery } from '../../../application/queries/get-notice-preferences.query';
import { UpdateNoticePreferenceCommand } from '../../../application/commands/update-notice-preference.command';
import { FindNoticePreferences } from '../../../domain/services/notice-preferences-find';
import { UpdateNoticePreference } from '../../../domain/services/notice-preference-update';
import { TypeOrmNoticePreferenceRepository } from '../../typeorm/repositories/typeorm-notice-preference.repository';
import { NoticeCatalogProvider } from '../services/notice-catalog.provider';
import { UpdateNoticePreferenceRequest } from '../dto/update-notice-preference.request';

/** The person's own choices for the notices that are not about a ticket. */
@Controller('notifications/notices')
export class NoticePreferenceController {
  constructor(
    @Inject() private readonly catalog: NoticeCatalogProvider,
    @Inject() private readonly preferenceRepository: TypeOrmNoticePreferenceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    const service = new FindNoticePreferences(this.catalog.catalog, this.preferenceRepository, this.memberRepository, this.userRepository);
    return new GetNoticePreferencesQuery(service).execute({ userId: user.userId });
  }

  @Put()
  async update(@Body() body: UpdateNoticePreferenceRequest, @CurrentUser() user: AuthUser) {
    const service = new UpdateNoticePreference(this.catalog.catalog, this.idGenerator, this.preferenceRepository);
    await new UpdateNoticePreferenceCommand(service).execute({ ...body, userId: user.userId });

    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.NOTIFICATION_PREFERENCES_UPDATED,
      entityType: 'notification-preferences',
      entityId: user.userId,
      userId: user.userId,
      workspaceId: null,
      metadata: { notice: body.kind, channel: body.channel, enabled: body.enabled },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });
    return { success: true };
  }
}
