import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/nest/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { CreateTag } from '../../../domain/services/tag-create';
import { DeleteTag } from '../../../domain/services/tag-delete';
import { CreateTagCommand } from '../../../application/commands/create-tag.command';
import { DeleteTagCommand } from '../../../application/commands/delete-tag.command';
import { ListTagsQuery } from '../../../application/queries/list-tags.query';
import { TypeOrmTagRepository } from '../../typeorm/repositories/typeorm-tag.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS, Permission } from '../../../../workspace/domain/permissions';
import { CreateTagRequest } from '../dto/create-tag.request';

@Controller('workspaces/:slug/tags')
@UseGuards(JwtAuthGuard)
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
    await this.ensure(workspaceId, user.userId, PERMISSIONS.TAG_CREATE);

    const service = new CreateTag(this.idGenerator, this.tagRepository);
    const command = new CreateTagCommand(service);
    return command.execute({
      name: body.name,
      color: body.color ?? null,
      workspaceId,
    });
  }

  @Get()
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensure(workspaceId, user.userId, PERMISSIONS.TAG_VIEW);

    const query = new ListTagsQuery(this.tagRepository);
    return query.execute({ workspaceId });
  }

  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensure(workspaceId, user.userId, PERMISSIONS.TAG_DELETE);

    const service = new DeleteTag(this.tagRepository);
    const command = new DeleteTagCommand(service);
    return command.execute({ id });
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace.getId();
  }

  private async ensure(workspaceId: string, userId: string, permission: Permission) {
    const service = new EnsureWorkspacePermission(this.memberRepository);
    return service.execute({ workspaceId, userId, permission });
  }
}
