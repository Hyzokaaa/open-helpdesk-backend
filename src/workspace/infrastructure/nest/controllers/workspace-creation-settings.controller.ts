import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { TypeOrmWorkspaceCreationSettingsRepository } from '../../typeorm/repositories/typeorm-workspace-creation-settings.repository';
import { UpdateWorkspaceCreationSettings } from '../../../domain/services/workspace-creation-settings-update';
import { UpdateWorkspaceCreationSettingsRequest } from '../dto/update-workspace-creation-settings.request';
import { workspaceCreationPolicy } from '../workspace-creation-policy';

@Controller('admin/workspace-settings')
export class WorkspaceCreationSettingsController {
  constructor(
    @Inject() private readonly repository: TypeOrmWorkspaceCreationSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    private readonly config: ConfigService,
  ) {}

  private ensureAdmin(user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');
  }

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    return workspaceCreationPolicy(this.repository, this.config).execute();
  }

  @Put()
  async update(@Body() body: UpdateWorkspaceCreationSettingsRequest, @CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    const policy = workspaceCreationPolicy(this.repository, this.config);
    const before = await policy.execute();
    const service = new UpdateWorkspaceCreationSettings(this.repository, this.idGenerator, policy);
    const after = await service.execute({ selfService: body.selfService });

    // Opening self-service creation changes who can create workspaces on the installation
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.WORKSPACE_CREATION_POLICY_UPDATED,
      entityType: 'system',
      entityId: 'workspace-creation',
      userId: user.userId,
      workspaceId: null,
      metadata: { before: { selfService: before.selfService }, after: { selfService: after.selfService } },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.WARNING,
      source: 'ui',
    });
    return after;
  }
}
