import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../domain/services/workspace-ensure-permission';
import { UpdateWorkspaceAnalyticsSettings } from '../../../domain/services/workspace-analytics-update';
import { UpdateWorkspaceAnalyticsCommand } from '../../../application/commands/update-workspace-analytics.command';
import { GetWorkspaceAnalyticsQuery } from '../../../application/queries/get-workspace-analytics.query';
import { GetWorkspacePublicAnalyticsQuery } from '../../../application/queries/get-workspace-public-analytics.query';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceAnalyticsSettingsRepository } from '../../typeorm/repositories/typeorm-workspace-analytics-settings.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { UpdateWorkspaceAnalyticsRequest } from '../dto/update-workspace-analytics.request';

@Controller('workspaces/:slug/analytics')
export class WorkspaceAnalyticsController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly analyticsRepository: TypeOrmWorkspaceAnalyticsSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Get()
  async get(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new GetWorkspaceAnalyticsQuery(this.analyticsRepository, ensurePermission);
    return query.execute({ workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Patch()
  async update(
    @Param('slug') slug: string,
    @Body() body: UpdateWorkspaceAnalyticsRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const updateSettings = new UpdateWorkspaceAnalyticsSettings(this.analyticsRepository, this.idGenerator);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new UpdateWorkspaceAnalyticsCommand(updateSettings, ensurePermission, auditLog);
    return command.execute({
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      provider: body.provider,
      serverUrl: body.serverUrl,
      siteId: body.siteId,
      useCookies: body.useCookies,
      trackEvents: body.trackEvents,
      shareWithInstallation: body.shareWithInstallation,
    });
  }

  /** Read by the portal and by anonymous visitors of a custom domain, before anyone signs in. */
  @Public()
  @Get('public')
  async getPublic(@Param('slug') slug: string) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const query = new GetWorkspacePublicAnalyticsQuery(this.analyticsRepository);
    return query.execute({ workspaceId });
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }
}
