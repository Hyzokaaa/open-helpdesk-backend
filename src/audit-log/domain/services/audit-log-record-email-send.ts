import { IdGenerator } from '../../../shared/domain/id-generator';
import { AuditAction } from '../enums/audit-action.enum';
import { AuditCategory } from '../enums/audit-category.enum';
import { AuditLevel } from '../enums/audit-level.enum';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { CreateAuditLogEntry } from './audit-log-create';

/** The outcome of a send, as the email services report it (`SendEmailResult`) */
interface SendOutcome {
  success: boolean;
  mock?: boolean;
  error?: string;
  errorCode?: string;
  via?: 'workspace' | 'global';
}

interface RecordEmailSendProps {
  result: SendOutcome;
  /** What the email is: `invitation`, `ticket-notification`, `password-reset`… */
  type: string;
  to: string | string[];
  subject: string;
  workspaceId: string | null;
  ticketId?: string | null;
  /** How people know the ticket: its title and, when the caller has it, its reference (TK-000042) */
  ticketName?: string | null;
  ticketReference?: string | null;
  /** The record the email is about, when it is not a ticket (an invitation, a survey, an account) */
  entityType?: string;
  entityId?: string;
  /** Who caused the email, when someone did (an inviter); automatic emails have none */
  userId?: string | null;
  source?: string;
}

/**
 * One entry per email, sent or not, with what is needed to tell why a person did not get it:
 * recipient, subject, type, ticket, the server used and the server's answer.
 *
 * A send that was only simulated for lack of a mail server is recorded as not sent. Links, tokens
 * and passwords never reach this entry: only the subject, never the body.
 */
export class RecordEmailSend {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: AuditLogRepository,
  ) {}

  async execute(props: RecordEmailSendProps): Promise<void> {
    const { result } = props;
    const sent = result.success && !result.mock;
    const metadata: Record<string, unknown> = {
      type: props.type,
      to: Array.isArray(props.to) ? props.to : [props.to],
      subject: props.subject,
      ...(props.ticketId && { ticketId: props.ticketId }),
      ...(props.ticketReference && { ticketReference: props.ticketReference }),
      ...(props.ticketName && { ticketName: props.ticketName }),
      ...(result.via && !result.mock && { via: result.via }),
    };
    if (!sent) {
      metadata.reason = result.mock ? 'no-email-service' : 'send-failed';
      if (result.error) metadata.error = result.error;
      if (result.errorCode) metadata.errorCode = result.errorCode;
    }

    // An audit write that fails must not turn into a failed send for the caller
    await new CreateAuditLogEntry(this.idGenerator, this.repository).execute({
      action: sent ? AuditAction.EMAIL_SENT : AuditAction.EMAIL_SEND_FAILED,
      // Kept apart from the ticket's own entries, so they do not fill its activity tab
      entityType: props.entityType ?? 'email',
      entityId: props.entityId ?? props.ticketId ?? props.workspaceId ?? 'system',
      userId: props.userId ?? null,
      workspaceId: props.workspaceId,
      metadata,
      category: AuditCategory.EMAIL,
      level: sent ? AuditLevel.INFO : result.mock ? AuditLevel.WARNING : AuditLevel.ERROR,
      source: props.source ?? 'system',
    }).catch(() => undefined);
  }
}
