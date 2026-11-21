import { Body, Controller, Delete, Get, Inject, Post } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EnvSecretCipher } from '../../../../shared/infrastructure/aes-secret-cipher';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { ConnectMatrixBot } from '../../../domain/services/matrix-bot-connect';
import { DisconnectMatrixBot } from '../../../domain/services/matrix-bot-disconnect';
import { ConnectMatrixBotCommand } from '../../../application/commands/connect-matrix-bot.command';
import { DisconnectMatrixBotCommand } from '../../../application/commands/disconnect-matrix-bot.command';
import { matrixBotView } from '../../../application/matrix-views';
import { HttpMatrixClient } from '../../http/http-matrix-client';
import { TypeOrmMatrixBotRepository } from '../../typeorm/repositories/typeorm-matrix-bot.repository';
import { TypeOrmMatrixRoomRepository } from '../../typeorm/repositories/typeorm-matrix-room.repository';
import { TypeOrmMatrixDirectRoomRepository } from '../../typeorm/repositories/typeorm-matrix-direct-room.repository';
import { CloseMatrixDirectRooms } from '../../../domain/services/matrix-direct-rooms-close';
import { HandOverMatrixRooms } from '../../../domain/services/matrix-rooms-hand-over';
import { ConnectMatrixBotRequest } from '../dto/connect-matrix-bot.request';

/** The installation's Matrix bot, which workspaces without one of their own write with. */
@Controller('system/matrix')
export class SystemMatrixController {
  constructor(
    @Inject() private readonly botRepository: TypeOrmMatrixBotRepository,
    @Inject() private readonly roomRepository: TypeOrmMatrixRoomRepository,
    @Inject() private readonly directRoomRepository: TypeOrmMatrixDirectRoomRepository,
    @Inject() private readonly client: HttpMatrixClient,
    @Inject() private readonly cipher: EnvSecretCipher,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  private ensureAdmin(user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');
  }

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    const bot = await this.botRepository.findInstallation();
    return { bot: bot ? matrixBotView(bot, this.cipher) : null };
  }

  @Post('bot')
  async connect(@Body() body: ConnectMatrixBotRequest, @CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    // The installation's administrator may use a server on the private network
    const handOver = new HandOverMatrixRooms(this.roomRepository, this.client, this.directRoomRepository);
    const connect = new ConnectMatrixBot(this.idGenerator, this.botRepository, this.client, this.cipher, async () => undefined, handOver);
    const command = new ConnectMatrixBotCommand(connect, this.cipher, this.idGenerator, this.auditLogRepository);
    return command.execute({ workspaceId: null, request: body, actorId: user.userId });
  }

  @Delete('bot')
  async disconnect(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    const command = new DisconnectMatrixBotCommand(new DisconnectMatrixBot(this.botRepository, this.client, this.cipher, new CloseMatrixDirectRooms(this.client, this.cipher, this.directRoomRepository, null)), this.idGenerator, this.auditLogRepository);
    return command.execute({ workspaceId: null, actorId: user.userId });
  }
}
