import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmWorkspaceCreationSettingsRepository } from '../../typeorm/repositories/typeorm-workspace-creation-settings.repository';
import { UpdateWorkspaceCreationSettings } from '../../../domain/services/workspace-creation-settings-update';
import { UpdateWorkspaceCreationSettingsRequest } from '../dto/update-workspace-creation-settings.request';
import { workspaceCreationPolicy } from '../workspace-creation-policy';

@Controller('admin/workspace-settings')
export class WorkspaceCreationSettingsController {
  constructor(
    @Inject() private readonly repository: TypeOrmWorkspaceCreationSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
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
    const service = new UpdateWorkspaceCreationSettings(
      this.repository,
      this.idGenerator,
      workspaceCreationPolicy(this.repository, this.config),
    );
    return service.execute({ selfService: body.selfService });
  }
}
