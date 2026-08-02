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
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
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
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
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
    const result = await command.execute({
      workspaceId: workspace.getId(),
      name: body.name,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.API_KEY_CREATED,
      entityType: 'api-key',
      entityId: result.id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { name: body.name },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
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
    const existing = await this.apiKeyRepository.findById(id);
    const service = new DeleteApiKey(this.apiKeyRepository);
    const command = new DeleteApiKeyCommand(service, ensurePermission);
    const result = await command.execute({
      id,
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.API_KEY_DELETED,
      entityType: 'api-key',
      entityId: id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { name: existing?.name },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
