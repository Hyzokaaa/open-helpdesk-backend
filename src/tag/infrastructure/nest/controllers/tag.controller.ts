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
import { CreateTag } from '../../../domain/services/tag-create';
import { DeleteTag } from '../../../domain/services/tag-delete';
import { CreateTagCommand } from '../../../application/commands/create-tag.command';
import { DeleteTagCommand } from '../../../application/commands/delete-tag.command';
import { ListTagsQuery } from '../../../application/queries/list-tags.query';
import { TypeOrmTagRepository } from '../../typeorm/repositories/typeorm-tag.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { CreateTagRequest } from '../dto/create-tag.request';

@Controller('workspaces/:slug/tags')
export class TagController {
  constructor(
    @Inject() private readonly tagRepository: TypeOrmTagRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateTagRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateTag(this.idGenerator, this.tagRepository);
    const command = new CreateTagCommand(service, ensurePermission);
    return command.execute({
      name: body.name,
      color: body.color ?? null,
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
    const query = new ListTagsQuery(this.tagRepository, ensurePermission);
    return query.execute({ workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new DeleteTag(this.tagRepository);
    const command = new DeleteTagCommand(service, ensurePermission);
    return command.execute({ id, workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }
}
