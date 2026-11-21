import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EnvSecretCipher } from '../../../../shared/infrastructure/aes-secret-cipher';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { FindMatrixDirectBot } from '../../../domain/services/matrix-direct-bot-find';
import { ListMatrixDirectChats } from '../../../domain/services/matrix-direct-chats-list';
import { ReconnectMatrixDirectChat } from '../../../domain/services/matrix-direct-chat-reconnect';
import { OpenMatrixDirectRoom } from '../../../domain/services/matrix-direct-room-open';
import { CloseMatrixDirectRooms } from '../../../domain/services/matrix-direct-rooms-close';
import { StartMatrixIdentityVerification } from '../../../domain/services/matrix-identity-start';
import { VerifyMatrixIdentity } from '../../../domain/services/matrix-identity-verify';
import { DisconnectMatrixIdentity } from '../../../domain/services/matrix-identity-disconnect';
import { CancelMatrixIdentityChange } from '../../../domain/services/matrix-identity-change-cancel';
import { CancelMatrixIdentityChangeCommand } from '../../../application/commands/cancel-matrix-identity-change.command';
import { GetMyMatrixQuery } from '../../../application/queries/get-my-matrix.query';
import { FindMatrixSetup } from '../../../domain/services/matrix-setup-find';
import { StartMatrixIdentityCommand } from '../../../application/commands/start-matrix-identity.command';
import { VerifyMatrixIdentityCommand } from '../../../application/commands/verify-matrix-identity.command';
import { DisconnectMatrixIdentityCommand } from '../../../application/commands/disconnect-matrix-identity.command';
import { ReconnectMatrixDirectChatCommand } from '../../../application/commands/reconnect-matrix-direct-chat.command';
import { HttpMatrixClient } from '../../http/http-matrix-client';
import { TypeOrmMatrixBotRepository } from '../../typeorm/repositories/typeorm-matrix-bot.repository';
import { TypeOrmMatrixIdentityRepository } from '../../typeorm/repositories/typeorm-matrix-identity.repository';
import { TypeOrmMatrixDirectRoomRepository } from '../../typeorm/repositories/typeorm-matrix-direct-room.repository';
import { StartMatrixIdentityRequest, VerifyMatrixIdentityRequest } from '../dto/matrix-identity.request';

/** The signed-in user's own Matrix account, where their personal notices go once verified. */
@Controller('matrix/me')
export class UserMatrixController {
  constructor(
    @Inject() private readonly identityRepository: TypeOrmMatrixIdentityRepository,
    @Inject() private readonly directRoomRepository: TypeOrmMatrixDirectRoomRepository,
    @Inject() private readonly botRepository: TypeOrmMatrixBotRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly client: HttpMatrixClient,
    @Inject() private readonly cipher: EnvSecretCipher,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return new GetMyMatrixQuery(this.identityRepository, this.findBot(), this.listChats(), new FindMatrixSetup(this.memberRepository, this.workspaceRepository, this.userRepository)).execute({ userId: user.userId });
  }

  /** Sends a code to that Matrix account; the service spaces codes out and caps them per day. */
  @Post()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async start(@CurrentUser() user: AuthUser, @Body() body: StartMatrixIdentityRequest) {
    const me = await this.userRepository.findById(user.userId);
    const service = new StartMatrixIdentityVerification(
      this.idGenerator,
      this.client,
      this.cipher,
      this.identityRepository,
      this.botRepository,
      this.findBot(),
      this.openRoom(),
      this.closeRooms(),
    );
    return new StartMatrixIdentityCommand(service).execute({ userId: user.userId, matrixUserId: body.matrixUserId, lang: me?.language ?? null });
  }

  @Post('verify')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verify(@CurrentUser() user: AuthUser, @Body() body: VerifyMatrixIdentityRequest) {
    const service = new VerifyMatrixIdentity(this.idGenerator, this.identityRepository, this.auditLogRepository, this.directRoomRepository, this.closeRooms());
    return new VerifyMatrixIdentityCommand(service).execute({ userId: user.userId, code: body.code });
  }

  /** After the user left or rejected one bot's chat: that bot invites them to a new one. */
  @Post('chats/:botId/reconnect')
  @HttpCode(204)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async reconnect(@CurrentUser() user: AuthUser, @Param('botId') botId: string): Promise<void> {
    const me = await this.userRepository.findById(user.userId);
    const service = new ReconnectMatrixDirectChat(this.client, this.cipher, this.identityRepository, this.listChats(), this.openRoom());
    await new ReconnectMatrixDirectChatCommand(service).execute({ userId: user.userId, botId, lang: me?.language ?? null });
  }

  /** Gives up the new ID being verified; the verified one goes on. */
  @Delete('pending')
  cancelChange(@CurrentUser() user: AuthUser) {
    const service = new CancelMatrixIdentityChange(this.identityRepository, this.closeRooms());
    return new CancelMatrixIdentityChangeCommand(service).execute({ userId: user.userId });
  }

  @Delete()
  @HttpCode(204)
  async disconnect(@CurrentUser() user: AuthUser): Promise<void> {
    const service = new DisconnectMatrixIdentity(this.idGenerator, this.identityRepository, this.closeRooms(), this.auditLogRepository);
    await new DisconnectMatrixIdentityCommand(service).execute({ userId: user.userId });
  }

  private findBot(): FindMatrixDirectBot {
    return new FindMatrixDirectBot(this.botRepository, this.memberRepository, this.userRepository);
  }

  private listChats(): ListMatrixDirectChats {
    return new ListMatrixDirectChats(this.botRepository, this.directRoomRepository, this.memberRepository, this.workspaceRepository, this.userRepository);
  }

  private openRoom(): OpenMatrixDirectRoom {
    return new OpenMatrixDirectRoom(this.idGenerator, this.client, this.cipher, this.directRoomRepository);
  }

  private closeRooms(): CloseMatrixDirectRooms {
    return new CloseMatrixDirectRooms(this.client, this.cipher, this.directRoomRepository, this.botRepository);
  }
}
