import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { CreateCannedResponse } from '../../../domain/services/canned-response-create';
import { UpdateCannedResponse } from '../../../domain/services/canned-response-update';
import { DeleteCannedResponse } from '../../../domain/services/canned-response-delete';
import { CreateCannedResponseCommand } from '../../../application/commands/create-canned-response.command';
import { UpdateCannedResponseCommand } from '../../../application/commands/update-canned-response.command';
import { DeleteCannedResponseCommand } from '../../../application/commands/delete-canned-response.command';
import { ListCannedResponsesQuery } from '../../../application/queries/list-canned-responses.query';
import { TypeOrmCannedResponseRepository } from '../../typeorm/repositories/typeorm-canned-response.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { CreateCannedResponseRequest } from '../dto/create-canned-response.request';
import { UpdateCannedResponseRequest } from '../dto/update-canned-response.request';

@Controller('workspaces/:slug/canned-responses')
export class CannedResponseController {
  constructor(
    @Inject() private readonly cannedResponseRepository: TypeOrmCannedResponseRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateCannedResponseRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateCannedResponse(this.idGenerator, this.cannedResponseRepository);
    const command = new CreateCannedResponseCommand(service, ensurePermission);
    return command.execute({
      title: body.title,
      content: body.content,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get()
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new ListCannedResponsesQuery(this.cannedResponseRepository, ensurePermission);
    return query.execute({ workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Put(':id')
  async update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: UpdateCannedResponseRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new UpdateCannedResponse(this.cannedResponseRepository);
    const command = new UpdateCannedResponseCommand(service, ensurePermission);
    return command.execute({
      id,
      title: body.title,
      content: body.content,
      workspaceId,
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
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new DeleteCannedResponse(this.cannedResponseRepository);
    const command = new DeleteCannedResponseCommand(service, ensurePermission);
    return command.execute({
      id,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }
}
