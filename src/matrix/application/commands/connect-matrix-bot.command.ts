import { Command } from '../../../shared/domain/command';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { ConnectMatrixBot } from '../../domain/services/matrix-bot-connect';
import { MatrixRoomsHandOver } from '../../domain/services/matrix-rooms-hand-over';
import { MatrixBotView, matrixBotView } from '../matrix-views';

interface Props {
  /** Null for the installation's bot. */
  workspaceId: string | null;
  request: { userId: string; password?: string | null; accessToken?: string | null; homeserverUrl?: string | null };
  actorId: string;
}

export interface ConnectMatrixBotResponse {
  bot: MatrixBotView;
  /** When another account replaced the bot: the rooms it got into, and those someone has to invite it to. */
  handOver: MatrixRoomsHandOver | null;
}

export class ConnectMatrixBotCommand implements Command<Props, ConnectMatrixBotResponse> {
  constructor(
    private readonly connectBot: ConnectMatrixBot,
    private readonly cipher: SecretCipher,
    private readonly idGenerator: IdGenerator,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(props: Props): Promise<ConnectMatrixBotResponse> {
    const { bot, handOver } = await this.connectBot.execute({ workspaceId: props.workspaceId, ...props.request });
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.MATRIX_BOT_CONNECTED,
      entityType: 'matrix-bot',
      entityId: bot.getId(),
      userId: props.actorId,
      workspaceId: props.workspaceId,
      metadata: {
        botUserId: bot.userId,
        homeserverUrl: bot.homeserverUrl,
        with: props.request.password ? 'password' : 'token',
        ...(handOver && { roomsHandedOver: handOver.moved, ...(handOver.notMoved.length > 0 && { roomsNotHandedOver: handOver.notMoved.map((r) => r.roomId) }) }),
      },
      category: props.workspaceId ? AuditCategory.CONFIG : AuditCategory.SYSTEM,
      level: AuditLevel.INFO,
      source: 'ui',
    });
    return { bot: matrixBotView(bot, this.cipher), handOver };
  }
}
