import { Command } from '../../../shared/domain/command';
import { TokenService } from '../../../shared/domain/token-service';
import { InvalidCredentialsError } from '../../../shared/domain/errors';
import { VerifyEmail } from '../../domain/services/user-verify-email';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  token: string;
  /** Who opened the link (IP, browser), recorded so a mail scanner can be told from a person. */
  client?: Record<string, unknown>;
}

export interface VerifyEmailResponse {
  message: string;
}

/**
 * Verifies the email of the link's owner. The link works as long as its token is valid, so it
 * can be opened again (a second click, a mail scanner): that answers the same and records
 * nothing new; the verification is recorded once.
 */
export class VerifyEmailCommand implements Command<Props, VerifyEmailResponse> {
  constructor(
    private readonly verifyEmail: VerifyEmail,
    private readonly tokenService: TokenService,
    private readonly createAuditLog?: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<VerifyEmailResponse> {
    let payload: { sub: string; type: string };
    try {
      payload = this.tokenService.verify<{ sub: string; type: string }>(props.token);
    } catch {
      throw new InvalidCredentialsError('Invalid or expired verification token');
    }

    if (payload.type !== 'email-verification') {
      throw new InvalidCredentialsError('Invalid verification token');
    }

    const { newlyVerified } = await this.verifyEmail.execute({ userId: payload.sub });
    if (newlyVerified) {
      await this.createAuditLog?.execute({
        action: AuditAction.USER_EMAIL_VERIFIED,
        entityType: 'user',
        entityId: payload.sub,
        userId: payload.sub,
        workspaceId: null,
        metadata: { userId: payload.sub, ...(props.client ? { client: props.client } : {}) },
        category: AuditCategory.USER,
        level: AuditLevel.INFO,
        source: 'ui',
      });
    }
    return { message: 'Email verified' };
  }
}
