import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { CreateApiKey } from '../../../domain/services/api-key-create';
import { DeleteApiKey } from '../../../domain/services/api-key-delete';
import { CreateApiKeyCommand } from '../../../application/commands/create-api-key.command';
import { DeleteApiKeyCommand } from '../../../application/commands/delete-api-key.command';
import { ListApiKeysQuery } from '../../../application/queries/list-api-keys.query';
import { TypeOrmApiKeyRepository } from '../../typeorm/repositories/typeorm-api-key.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { CreateApiKeyRequest } from '../dto/create-api-key.request';

@Controller('workspaces/:slug/api-keys')
export class ApiKeyController {
  constructor(
    @Inject() private readonly apiKeyRepository: TypeOrmApiKeyRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateApiKeyRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateApiKey(this.idGenerator, this.apiKeyRepository);
    const command = new CreateApiKeyCommand(service, ensurePermission);
    return command.execute({
      workspaceId: workspace.getId(),
      name: body.name,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get()
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new ListApiKeysQuery(this.apiKeyRepository, ensurePermission);
    return query.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new DeleteApiKey(this.apiKeyRepository);
    const command = new DeleteApiKeyCommand(service, ensurePermission);
    return command.execute({
      id,
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
