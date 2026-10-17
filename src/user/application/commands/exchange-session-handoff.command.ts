import { Command } from '../../../shared/domain/command';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { ExchangeSessionHandoff } from '../../domain/services/user-session-handoff-exchange';

interface Props {
  code: string;
  codeVerifier: string;
  origin: string;
  client: unknown;
}

export interface ExchangeSessionHandoffResponse {
  accessToken: string;
  refreshToken: string;
}

export class ExchangeSessionHandoffCommand implements Command<Props, ExchangeSessionHandoffResponse> {
  constructor(
    private readonly exchangeHandoff: ExchangeSessionHandoff,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<ExchangeSessionHandoffResponse> {
    const result = await this.exchangeHandoff.execute({
      code: props.code,
      codeVerifier: props.codeVerifier,
      origin: props.origin,
    });

    await this.createAuditLog.execute({
      action: AuditAction.SESSION_HANDED_OVER,
      entityType: 'user',
      entityId: result.userId,
      userId: result.userId,
      workspaceId: null,
      metadata: { from: result.from, to: result.to, client: props.client },
      category: AuditCategory.SECURITY,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { accessToken: result.tokens.accessToken, refreshToken: result.tokens.refreshToken };
  }
}
