import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { SystemAnalyticsSettings } from '../../../domain/entities/system-analytics-settings';
import { UpdateSystemAnalyticsSettings } from '../../../domain/services/system-analytics-update';
import { TypeOrmSystemAnalyticsSettingsRepository } from '../../typeorm/repositories/typeorm-system-analytics-settings.repository';
import { UpdateSystemAnalyticsRequest } from '../dto/update-system-analytics.request';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';

@Controller('admin')
export class SystemAnalyticsController {
  constructor(
    @Inject() private readonly repository: TypeOrmSystemAnalyticsSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  private ensureAdmin(user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');
  }

  private toResponse(settings: SystemAnalyticsSettings | null) {
    return {
      provider: settings?.provider ?? null,
      serverUrl: settings?.serverUrl ?? null,
      siteId: settings?.siteId ?? null,
      useCookies: settings?.useCookies ?? false,
      trackEvents: settings?.trackEvents ?? true,
    };
  }

  @Get('analytics')
  async get(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    return this.toResponse(await this.repository.find());
  }

  @Patch('analytics')
  async update(@Body() body: UpdateSystemAnalyticsRequest, @CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);

    const updateSettings = new UpdateSystemAnalyticsSettings(this.repository, this.idGenerator);
    const { settings, before, after } = await updateSettings.execute({
      provider: body.provider,
      serverUrl: body.serverUrl,
      siteId: body.siteId,
      useCookies: body.useCookies,
      trackEvents: body.trackEvents,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.SYSTEM_ANALYTICS_UPDATED,
      entityType: 'system',
      entityId: settings.id,
      userId: user.userId,
      workspaceId: null,
      metadata: { before, after },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return this.toResponse(settings);
  }
}
