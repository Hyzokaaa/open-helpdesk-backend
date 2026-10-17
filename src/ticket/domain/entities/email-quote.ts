import { Id } from '../../../shared/domain/id';

export type EmailQuoteMethod = 'marker' | 'html' | 'text' | 'none';

interface Props {
  id: string;
  ticketId: string;
  /** The comment the email became, or null for the email that opened the ticket. */
  commentId: string | null;
  content: string;
  method: EmailQuoteMethod;
}

/**
 * What an inbound email carried besides what its sender wrote: the quoted message they
 * answered and their signature. Nothing of an email is thrown away; this part is folded under
 * the comment (or the description) and shown on demand.
 */
export class EmailQuote {
  readonly id: Id;
  ticketId: string;
  commentId: string | null;
  /** Plain text, never HTML. */
  content: string;
  /** How it was told apart from the reply. */
  method: EmailQuoteMethod;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.ticketId = props.ticketId;
    this.commentId = props.commentId;
    this.content = props.content;
    this.method = props.method;
  }

  getId(): string {
    return this.id.get();
  }

  lineCount(): number {
    return this.content.split('\n').length;
  }
}
