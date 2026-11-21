import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EnvSecretCipher } from '../../../../shared/infrastructure/aes-secret-cipher';
import { ensurePublicUrl, privateNetworkUrlsAllowed } from '../../../../shared/infrastructure/private-network';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmDepartmentRepository } from '../../../../department/infrastructure/typeorm/repositories/typeorm-department.repository';
import { TypeOrmProjectRepository } from '../../../../project/infrastructure/typeorm/repositories/typeorm-project.repository';
import { TypeOrmOrganizationRepository } from '../../../../organization/infrastructure/typeorm/repositories/typeorm-organization.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../../workspace/domain/permissions';
import { ConnectMatrixBot } from '../../../domain/services/matrix-bot-connect';
import { DisconnectMatrixBot } from '../../../domain/services/matrix-bot-disconnect';
import { SaveMatrixRoom } from '../../../domain/services/matrix-room-save';
import { ReserveMatrixRoomCreation } from '../../../domain/services/matrix-room-creation-reserve';
import { TypeOrmMatrixRoomCreationRepository } from '../../typeorm/repositories/typeorm-matrix-room-creation.repository';
import { CheckMatrixRoom } from '../../../domain/services/matrix-room-check';
import { InspectMatrixRoom } from '../../../domain/services/matrix-room-inspect';
import { LeaveCheckedMatrixRoom } from '../../../domain/services/matrix-room-checked-leave';
import { RemoveMatrixRoom } from '../../../domain/services/matrix-room-remove';
import { LeaveMatrixRoom } from '../../../domain/services/matrix-room-leave';
import { PauseMatrixRoom } from '../../../domain/services/matrix-room-pause';
import { FindMatrixRoomScope } from '../../../domain/services/matrix-room-scope-find';
import { HandOverMatrixRooms } from '../../../domain/services/matrix-rooms-hand-over';
import { DeliverMatrixNotice } from '../../../domain/services/matrix-notice-deliver';
import { SendMatrixPlainNotice } from '../../../domain/services/matrix-plain-notice-send';
import { ConnectMatrixBotCommand } from '../../../application/commands/connect-matrix-bot.command';
import { DisconnectMatrixBotCommand } from '../../../application/commands/disconnect-matrix-bot.command';
import { SaveMatrixRoomCommand } from '../../../application/commands/save-matrix-room.command';
import { CheckMatrixRoomCommand } from '../../../application/commands/check-matrix-room.command';
import { LeaveCheckedMatrixRoomCommand } from '../../../application/commands/leave-checked-matrix-room.command';
import { GetMatrixRoomStatusQuery } from '../../../application/queries/get-matrix-room-status.query';
import { RemoveMatrixRoomCommand } from '../../../application/commands/remove-matrix-room.command';
import { PauseMatrixRoomCommand } from '../../../application/commands/pause-matrix-room.command';
import { SendMatrixTestNoticeCommand } from '../../../application/commands/send-matrix-test-notice.command';
import { GetMatrixSettingsQuery } from '../../../application/queries/get-matrix-settings.query';
import { HttpMatrixClient } from '../../http/http-matrix-client';
import { TypeOrmMatrixBotRepository } from '../../typeorm/repositories/typeorm-matrix-bot.repository';
import { TypeOrmMatrixRoomRepository } from '../../typeorm/repositories/typeorm-matrix-room.repository';
import { TypeOrmMatrixDirectRoomRepository } from '../../typeorm/repositories/typeorm-matrix-direct-room.repository';
import { CloseMatrixDirectRooms } from '../../../domain/services/matrix-direct-rooms-close';
import { TypeOrmMatrixTicketThreadRepository } from '../../typeorm/repositories/typeorm-matrix-ticket-thread.repository';
import { ConnectMatrixBotRequest } from '../dto/connect-matrix-bot.request';
import { SaveMatrixRoomRequest } from '../dto/save-matrix-room.request';
import { CheckMatrixRoomRequest } from '../dto/check-matrix-room.request';

/** A workspace's Matrix notices: its own bot (optional) and the rooms its notices go to. */
@Controller('workspaces/:slug/matrix')
export class WorkspaceMatrixController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly botRepository: TypeOrmMatrixBotRepository,
    @Inject() private readonly roomRepository: TypeOrmMatrixRoomRepository,
    @Inject() private readonly directRoomRepository: TypeOrmMatrixDirectRoomRepository,
    @Inject() private readonly roomCreationRepository: TypeOrmMatrixRoomCreationRepository,
    @Inject() private readonly threadRepository: TypeOrmMatrixTicketThreadRepository,
    @Inject() private readonly client: HttpMatrixClient,
    @Inject() private readonly cipher: EnvSecretCipher,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly departmentRepository: TypeOrmDepartmentRepository,
    @Inject() private readonly projectRepository: TypeOrmProjectRepository,
    @Inject() private readonly organizationRepository: TypeOrmOrganizationRepository,
  ) {}

  @Get()
  async get(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    return new GetMatrixSettingsQuery(this.botRepository, this.roomRepository, this.cipher, this.findScope()).execute({ workspaceId });
  }

  @Post('bot')
  async connectBot(@Param('slug') slug: string, @Body() body: ConnectMatrixBotRequest, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    // A workspace's own server is typed by someone other than the installation's administrator
    const ensureReachable = privateNetworkUrlsAllowed() ? async () => undefined : (url: string) => ensurePublicUrl(url);
    const handOver = new HandOverMatrixRooms(this.roomRepository, this.client, this.directRoomRepository);
    const connect = new ConnectMatrixBot(this.idGenerator, this.botRepository, this.client, this.cipher, ensureReachable, handOver);
    const command = new ConnectMatrixBotCommand(connect, this.cipher, this.idGenerator, this.auditLogRepository);
    return command.execute({ workspaceId, request: body, actorId: user.userId });
  }

  @Delete('bot')
  async disconnectBot(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    const command = new DisconnectMatrixBotCommand(new DisconnectMatrixBot(this.botRepository, this.client, this.cipher, new CloseMatrixDirectRooms(this.client, this.cipher, this.directRoomRepository, null)), this.idGenerator, this.auditLogRepository);
    return command.execute({ workspaceId, actorId: user.userId });
  }

  @Post('rooms')
  async addRoom(@Param('slug') slug: string, @Body() body: SaveMatrixRoomRequest, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    return this.saveCommand().execute({ workspaceId, request: body, actorId: user.userId, actorIsSystemAdmin: user.isSystemAdmin });
  }

  @Put('rooms/:id')
  async saveRoom(@Param('slug') slug: string, @Param('id') id: string, @Body() body: SaveMatrixRoomRequest, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    return this.saveCommand().execute({ workspaceId, id, request: body, actorId: user.userId, actorIsSystemAdmin: user.isSystemAdmin });
  }

  /** The bot joins the room typed (accepting the invitation) and tells its name and members; nothing is saved. */
  @Post('rooms/check')
  async checkRoom(@Param('slug') slug: string, @Body() body: CheckMatrixRoomRequest, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    const command = new CheckMatrixRoomCommand(new CheckMatrixRoom(this.botRepository, this.roomRepository, this.client, this.cipher));
    return { check: await command.execute({ workspaceId, room: body.room, actorIsSystemAdmin: user.isSystemAdmin }) };
  }

  /** The bot leaves a room it joined only to check it, when it was not saved; it stays where it writes. */
  @Post('rooms/check/leave')
  @HttpCode(200)
  async leaveCheckedRoom(@Param('slug') slug: string, @Body() body: CheckMatrixRoomRequest, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    const leave = new LeaveCheckedMatrixRoom(this.botRepository, this.roomRepository, this.client, this.cipher);
    return new LeaveCheckedMatrixRoomCommand(leave).execute({ workspaceId, room: body.room });
  }

  /** Whether the bot is still in a saved room, and its name and members; the bot never joins here. */
  @Get('rooms/:id/status')
  async roomStatus(@Param('slug') slug: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    const inspect = new InspectMatrixRoom(this.botRepository, this.roomRepository, this.client, this.cipher);
    return { status: await new GetMatrixRoomStatusQuery(inspect).execute({ workspaceId, id }) };
  }

  /** ?botLeaves=true: the bot says goodbye and leaves the room, unless it still writes there for another workspace. */
  @Delete('rooms/:id')
  async removeRoom(@Param('slug') slug: string, @Param('id') id: string, @Query('botLeaves') botLeaves: string | undefined, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    const leave = new LeaveMatrixRoom(this.roomRepository, this.botRepository, this.workspaceRepository, this.client, this.cipher);
    const command = new RemoveMatrixRoomCommand(new RemoveMatrixRoom(this.roomRepository, leave), this.idGenerator, this.auditLogRepository);
    const left = await command.execute({ workspaceId, id, botLeaves: botLeaves === 'true', actorId: user.userId });
    return { message: 'Matrix room removed', left };
  }

  /** Stops the room's notices until a test notice reaches it. */
  @Post('rooms/:id/pause')
  async pauseRoom(@Param('slug') slug: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    return { room: await new PauseMatrixRoomCommand(new PauseMatrixRoom(this.roomRepository), this.idGenerator, this.auditLogRepository).execute({ workspaceId, id, actorId: user.userId }) };
  }

  @Post('rooms/:id/test')
  async test(@Param('slug') slug: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.authorize(slug, user);
    const deliver = new DeliverMatrixNotice(this.idGenerator, this.client, this.cipher, this.roomRepository, this.threadRepository, this.auditLogRepository);
    const plain = new SendMatrixPlainNotice(this.roomRepository, this.botRepository, this.workspaceRepository, deliver);
    return new SendMatrixTestNoticeCommand(plain, this.findScope(), this.idGenerator, this.auditLogRepository).execute({ workspaceId, id, actorId: user.userId });
  }

  private findScope(): FindMatrixRoomScope {
    return new FindMatrixRoomScope(this.departmentRepository, this.projectRepository, this.organizationRepository);
  }

  private saveCommand(): SaveMatrixRoomCommand {
    const save = new SaveMatrixRoom(this.idGenerator, this.roomRepository, this.botRepository, this.client, this.cipher, this.findScope(), new ReserveMatrixRoomCreation(this.idGenerator, this.roomCreationRepository));
    return new SaveMatrixRoomCommand(save, this.findScope(), this.idGenerator, this.auditLogRepository);
  }

  private async authorize(slug: string, user: AuthUser): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    await new EnsureWorkspacePermission(this.memberRepository).execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    return workspace.getId();
  }
}
