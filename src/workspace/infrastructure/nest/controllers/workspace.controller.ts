import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { CreateWorkspace } from '../../../domain/services/workspace-create';
import { AddWorkspaceMember } from '../../../domain/services/workspace-add-member';
import { RemoveWorkspaceMember } from '../../../domain/services/workspace-remove-member';
import { EnsureWorkspacePermission } from '../../../domain/services/workspace-ensure-permission';
import { CreateWorkspaceCommand } from '../../../application/commands/create-workspace.command';
import { AddMemberCommand } from '../../../application/commands/add-member.command';
import { RemoveMemberCommand } from '../../../application/commands/remove-member.command';
import { ChangeWorkspaceMemberRole } from '../../../domain/services/workspace-change-member-role';
import { ChangeMemberRoleCommand } from '../../../application/commands/change-member-role.command';
import { UpdateWorkspace } from '../../../domain/services/workspace-update';
import { UpdateWorkspaceCommand } from '../../../application/commands/update-workspace.command';
import { UpdateWorkspacePalette } from '../../../domain/services/workspace-update-palette';
import { UpdateWorkspacePaletteCommand } from '../../../application/commands/update-workspace-palette.command';
import { PERMISSIONS } from '../../../domain/permissions';
import { DeleteWorkspace } from '../../../domain/services/workspace-delete';
import { DeleteWorkspaceCommand } from '../../../application/commands/delete-workspace.command';
import { GetWorkspaceQuery } from '../../../application/queries/get-workspace.query';
import { ListWorkspacesQuery } from '../../../application/queries/list-workspaces.query';
import { ListWorkspaceMembersQuery } from '../../../application/queries/list-workspace-members.query';
import { GetMyPermissionsQuery } from '../../../application/queries/get-my-permissions.query';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmAccountRepository } from '../../../../account/infrastructure/typeorm/repositories/typeorm-account.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmMailboxRepository } from '../../../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { CreateMailbox } from '../../../../mailbox/domain/services/mailbox-create';
import { CreateWorkspaceRequest } from '../dto/create-workspace.request';
import { AddMemberRequest } from '../dto/add-member.request';
import { SortDto } from '../../../../shared/nest/dto/sort.dto';
import { ConfigService } from '@nestjs/config';

@Controller('workspaces')
export class WorkspaceController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly accountRepository: TypeOrmAccountRepository,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly mailboxRepository: TypeOrmMailboxRepository,
    @Inject() private readonly config: ConfigService,
  ) {}

  @Post()
  async create(@Body() body: CreateWorkspaceRequest, @CurrentUser() user: AuthUser) {
    const account = await this.accountRepository.findByOwnerId(user.userId);
    const createService = new CreateWorkspace(this.idGenerator, this.workspaceRepository);
    const addMemberService = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const supportEmailDomain = this.config.get<string>('SUPPORT_EMAIL_DOMAIN');
    const createMailbox = supportEmailDomain
      ? new CreateMailbox(this.idGenerator, this.mailboxRepository)
      : undefined;
    const command = new CreateWorkspaceCommand(createService, addMemberService, auditLog, createMailbox);
    return command.execute({
      name: body.name,
      description: body.description,
      creatorUserId: user.userId,
      accountId: account?.getId(),
      supportEmailDomain,
    });
  }

  @Get()
  list(@Query() sort: SortDto, @CurrentUser() user: AuthUser) {
    const query = new ListWorkspacesQuery(this.memberRepository, this.workspaceRepository, this.accountRepository, this.userRepository);
    return query.execute({ userId: user.userId, isSystemAdmin: user.isSystemAdmin, sort });
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    const query = new GetWorkspaceQuery(this.workspaceRepository, this.mailboxRepository);
    return query.execute({ slug });
  }

  @Patch(':slug')
  async update(
    @Param('slug') slug: string,
    @Body() body: { name?: string; description?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const service = new UpdateWorkspace(this.workspaceRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new UpdateWorkspaceCommand(service, auditLog);
    return command.execute({
      workspaceId,
      name: body.name,
      description: body.description,
      isSystemAdmin: user.isSystemAdmin,
      userId: user.userId,
    });
  }

  @Delete(':slug')
  async remove(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const service = new DeleteWorkspace(this.workspaceRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new DeleteWorkspaceCommand(service, auditLog);
    return command.execute({ workspaceId, isSystemAdmin: user.isSystemAdmin, userId: user.userId });
  }

  @Post(':slug/members')
  async addMember(
    @Param('slug') slug: string,
    @Body() body: AddMemberRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const targetUser = await this.userRepository.findById(body.userId);
    const command = new AddMemberCommand(service, ensurePermission, auditLog);
    return command.execute({
      workspaceId,
      userId: body.userId,
      role: body.role,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      targetLabel: targetUser ? `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})` : body.userId,
    });
  }

  @Get(':slug/permissions')
  async myPermissions(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const query = new GetMyPermissionsQuery(this.memberRepository);
    return query.execute({ workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Get(':slug/members')
  async listMembers(@Param('slug') slug: string) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const query = new ListWorkspaceMembersQuery(this.memberRepository, this.userRepository);
    return query.execute({ workspaceId });
  }

  @Patch(':slug/members/:userId/role')
  async changeMemberRole(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Body() body: { role: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const targetUser = await this.userRepository.findById(userId);
    const service = new ChangeWorkspaceMemberRole(this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new ChangeMemberRoleCommand(service, auditLog);
    return command.execute({
      workspaceId,
      targetUserId: userId,
      newRole: body.role as any,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      targetLabel: targetUser ? `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})` : userId,
    });
  }

  @Delete(':slug/members/:userId')
  async removeMember(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new RemoveWorkspaceMember(this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const targetUser = await this.userRepository.findById(userId);
    const command = new RemoveMemberCommand(service, ensurePermission, auditLog);
    return command.execute({ workspaceId, userId, requestingUserId: user.userId, isSystemAdmin: user.isSystemAdmin, targetLabel: targetUser ? `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})` : userId });
  }

  @Patch(':slug/palette')
  async updatePalette(
    @Param('slug') slug: string,
    @Body() body: { palette: string | null },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const service = new UpdateWorkspacePalette(this.workspaceRepository);
    const command = new UpdateWorkspacePaletteCommand(service);
    return command.execute({ workspaceId, palette: body.palette });
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }
}
