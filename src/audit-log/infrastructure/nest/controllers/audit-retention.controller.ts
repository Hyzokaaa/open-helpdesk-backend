import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { AccessDeniedError, EntityNotFoundError } from '../../../../shared/domain/errors';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../../workspace/domain/permissions';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { AuditRetentionSettings } from '../../../domain/entities/audit-retention-settings';
import { WorkspaceAuditRetention } from '../../../domain/entities/workspace-audit-retention';
import { UpdateAuditRetentionSettings } from '../../../domain/services/audit-retention-update';
import { UpdateWorkspaceAuditRetention } from '../../../domain/services/workspace-audit-retention-update';
import { CreateAuditLogEntry } from '../../../domain/services/audit-log-create';
import { AuditAction } from '../../../domain/enums/audit-action.enum';
import { AuditCategory } from '../../../domain/enums/audit-category.enum';
import { AuditLevel } from '../../../domain/enums/audit-level.enum';
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  RETENTION_CATEGORIES,
  effectiveRetention,
} from '../../../domain/audit-retention';
import { TypeOrmAuditRetentionSettingsRepository } from '../../typeorm/repositories/typeorm-audit-retention-settings.repository';
import { TypeOrmWorkspaceAuditRetentionRepository } from '../../typeorm/repositories/typeorm-workspace-audit-retention.repository';
import { TypeOrmAuditLogRepository } from '../../typeorm/repositories/typeorm-audit-log.repository';

/**
 * Audit retention: the installation's, set by system admins, and each workspace's, which can only
 * keep its own history longer.
 */
@Controller()
export class AuditRetentionController {
  constructor(
    @Inject() private readonly settingsRepository: TypeOrmAuditRetentionSettingsRepository,
    @Inject() private readonly workspaceRetentionRepository: TypeOrmWorkspaceAuditRetentionRepository,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  private async installation(): Promise<AuditRetentionSettings> {
    return (await this.settingsRepository.find()) ?? new AuditRetentionSettings({ id: this.idGenerator.create() });
  }

  private limits() {
    return { categories: RETENTION_CATEGORIES, defaults: DEFAULT_RETENTION_DAYS, minDays: MIN_RETENTION_DAYS, maxDays: MAX_RETENTION_DAYS };
  }

  @Get('admin/audit-retention')
  async getInstallation(@CurrentUser() user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');
    const settings = await this.installation();
    return { enabled: settings.enabled, days: settings.days, ...this.limits() };
  }

  @Put('admin/audit-retention')
  async updateInstallation(
    @Body() body: { enabled?: boolean; days?: Record<string, number | null> },
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');
    const { settings, before, after } = await new UpdateAuditRetentionSettings(this.settingsRepository, this.idGenerator)
      .execute({ enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined, days: body?.days });

    // Turning retention on or shortening it deletes history, so the change is a warning
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.AUDIT_RETENTION_UPDATED,
      entityType: 'system',
      entityId: 'audit-retention',
      userId: user.userId,
      workspaceId: null,
      metadata: { before, after },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.WARNING,
      source: 'ui',
    });
    return { enabled: settings.enabled, days: settings.days, ...this.limits() };
  }

  @Get('workspaces/:slug/audit-retention')
  async getWorkspace(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.ensureCanManage(slug, user);
    const installation = await this.installation();
    const own = (await this.workspaceRetentionRepository.findByWorkspaceId(workspaceId)) ?? new WorkspaceAuditRetention({ workspaceId });
    return this.workspaceResponse(installation, own);
  }

  @Put('workspaces/:slug/audit-retention')
  async updateWorkspace(
    @Param('slug') slug: string,
    @Body() body: { days?: Record<string, number | null> },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.ensureCanManage(slug, user);
    const installation = await this.installation();
    const { retention, before, after } = await new UpdateWorkspaceAuditRetention(this.workspaceRetentionRepository)
      .execute({ workspaceId, days: body?.days ?? {}, installation });

    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.WORKSPACE_AUDIT_RETENTION_UPDATED,
      entityType: 'workspace',
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { before, after },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });
    return this.workspaceResponse(installation, retention);
  }

  private workspaceResponse(installation: AuditRetentionSettings, own: WorkspaceAuditRetention) {
    return {
      installation: { enabled: installation.enabled, days: installation.days },
      overrides: own.days,
      effective: effectiveRetention(installation.days, own.days),
      ...this.limits(),
    };
  }

  private async ensureCanManage(slug: string, user: AuthUser): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    await new EnsureWorkspacePermission(this.memberRepository).execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    return workspace.getId();
  }
}
