import { Query } from '../../../shared/domain/query';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { EnsureTicketAccess } from '../../domain/services/ticket-ensure-access';
import { EmailQuoteRepository } from '../../domain/repositories/email-quote.repository';

interface Props {
  ticketId: string;
  /** The comment it is folded under, or null for the ticket's description. */
  commentId: string | null;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface EmailQuoteResponse {
  content: string;
  lineCount: number;
}

/** The quoted text folded under a comment or the description; whoever sees the ticket sees it. */
export class GetEmailQuoteQuery implements Query<Props, EmailQuoteResponse> {
  constructor(
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly repository: EmailQuoteRepository,
  ) {}

  async execute(props: Props): Promise<EmailQuoteResponse> {
    await this.ensureTicketAccess.execute({
      ticketId: props.ticketId,
      workspaceId: props.workspaceId,
      userId: props.userId,
      isSystemAdmin: props.isSystemAdmin,
    });
    const quote = await this.repository.findByTicketAndComment(props.ticketId, props.commentId);
    if (!quote) throw new EntityNotFoundError('Quoted text not found');
    return { content: quote.content, lineCount: quote.lineCount() };
  }
}
