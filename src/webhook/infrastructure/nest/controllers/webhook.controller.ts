import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { CreateWebhook } from '../../../domain/services/webhook-create';
import { UpdateWebhook } from '../../../domain/services/webhook-update';
import { DeleteWebhook } from '../../../domain/services/webhook-delete';
import { CreateWebhookCommand } from '../../../application/commands/create-webhook.command';
import { UpdateWebhookCommand } from '../../../application/commands/update-webhook.command';
import { DeleteWebhookCommand } from '../../../application/commands/delete-webhook.command';
import { ListWebhooksQuery } from '../../../application/queries/list-webhooks.query';
import { TypeOrmWebhookRepository } from '../../typeorm/repositories/typeorm-webhook.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { CreateWebhookRequest } from '../dto/create-webhook.request';
import { UpdateWebhookRequest } from '../dto/update-webhook.request';

@Controller('workspaces/:slug/webhooks')
export class WebhookController {
  constructor(
    @Inject() private readonly webhookRepository: TypeOrmWebhookRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateWebhookRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateWebhook(this.idGenerator, this.webhookRepository);
    const command = new CreateWebhookCommand(service, ensurePermission);
    return command.execute({
      workspaceId: workspace.getId(),
      url: body.url,
      events: body.events,
      secret: body.secret,
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
    const query = new ListWebhooksQuery(this.webhookRepository, ensurePermission);
    return query.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Patch(':id')
  async update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: UpdateWebhookRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new UpdateWebhook(this.webhookRepository);
    const command = new UpdateWebhookCommand(service, ensurePermission);
    return command.execute({
      id,
      workspaceId: workspace.getId(),
      url: body.url,
      events: body.events,
      isActive: body.isActive,
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
    const service = new DeleteWebhook(this.webhookRepository);
    const command = new DeleteWebhookCommand(service, ensurePermission);
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
