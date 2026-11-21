import { Command } from '../../../shared/domain/command';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { DisconnectMatrixBot } from '../../domain/services/matrix-bot-disconnect';

interface Props {
  workspaceId: string | null;
  actorId: string;
}

export class DisconnectMatrixBotCommand implements Command<Props, { sessionEnded: boolean }> {
  constructor(
    private readonly disconnectBot: DisconnectMatrixBot,
    private readonly idGenerator: IdGenerator,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(props: Props): Promise<{ sessionEnded: boolean }> {
    const { bot, sessionEnded } = await this.disconnectBot.execute({ workspaceId: props.workspaceId });
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.MATRIX_BOT_DISCONNECTED,
      entityType: 'matrix-bot',
      entityId: bot.getId(),
      userId: props.actorId,
      workspaceId: props.workspaceId,
      metadata: { botUserId: bot.userId, homeserverUrl: bot.homeserverUrl, sessionEnded },
      category: props.workspaceId ? AuditCategory.CONFIG : AuditCategory.SYSTEM,
      level: sessionEnded ? AuditLevel.INFO : AuditLevel.WARNING,
      source: 'ui',
    });
    return { sessionEnded };
  }
}
