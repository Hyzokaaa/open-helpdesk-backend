import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { CreateWorkspace } from '../../../domain/services/workspace-create';
import { AddWorkspaceMember } from '../../../domain/services/workspace-add-member';
import { RemoveWorkspaceMember } from '../../../domain/services/workspace-remove-member';
import { EnsureWorkspacePermission } from '../../../domain/services/workspace-ensure-permission';
import { PERMISSIONS, Permission } from '../../../domain/permissions';
import { CreateWorkspaceCommand } from '../../../application/commands/create-workspace.command';
import { AddMemberCommand } from '../../../application/commands/add-member.command';
import { RemoveMemberCommand } from '../../../application/commands/remove-member.command';
import { GetWorkspaceQuery } from '../../../application/queries/get-workspace.query';
import { ListWorkspacesQuery } from '../../../application/queries/list-workspaces.query';
import { ListWorkspaceMembersQuery } from '../../../application/queries/list-workspace-members.query';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../typeorm/repositories/typeorm-workspace-member.repository';
import { CreateWorkspaceRequest } from '../dto/create-workspace.request';
import { AddMemberRequest } from '../dto/add-member.request';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  @Post()
  create(@Body() body: CreateWorkspaceRequest, @CurrentUser() user: AuthUser) {
    if (!user.isSystemAdmin) {
      throw new ForbiddenException('Only system admins can create workspaces');
    }

    const createService = new CreateWorkspace(this.idGenerator, this.workspaceRepository);
    const addMemberService = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
    const command = new CreateWorkspaceCommand(createService, addMemberService);
    return command.execute({
      name: body.name,
      description: body.description,
      dealerId: body.dealerId ?? null,
      creatorUserId: user.userId,
    });
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    const query = new ListWorkspacesQuery(this.memberRepository, this.workspaceRepository);
    return query.execute({ userId: user.userId });
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    const query = new GetWorkspaceQuery(this.workspaceRepository);
    return query.execute({ slug });
  }

  @Post(':slug/members')
  async addMember(
    @Param('slug') slug: string,
    @Body() body: AddMemberRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensure(workspaceId, user.userId, PERMISSIONS.WORKSPACE_MEMBERS_MANAGE);

    const service = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
    const command = new AddMemberCommand(service);
    return command.execute({
      workspaceId,
      userId: body.userId,
      role: body.role,
    });
  }

  @Get(':slug/permissions')
  async myPermissions(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const member = await this.memberRepository.findByWorkspaceAndUser(workspaceId, user.userId);
    if (!member) return { permissions: [] };

    const { getPermissionsForRole } = await import('../../../domain/permissions');
    return { permissions: getPermissionsForRole(member.role) };
  }

  @Get(':slug/members')
  async listMembers(@Param('slug') slug: string) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const query = new ListWorkspaceMembersQuery(this.memberRepository, this.userRepository);
    return query.execute({ workspaceId });
  }

  @Delete(':slug/members/:userId')
  async removeMember(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensure(workspaceId, user.userId, PERMISSIONS.WORKSPACE_MEMBERS_MANAGE);

    const service = new RemoveWorkspaceMember(this.memberRepository);
    const command = new RemoveMemberCommand(service);
    return command.execute({ workspaceId, userId });
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
