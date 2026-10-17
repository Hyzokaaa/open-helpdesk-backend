import { IdGenerator } from '../../../shared/domain/id-generator';
import { EmailQuote, EmailQuoteMethod } from '../entities/email-quote';
import { EmailQuoteRepository } from '../repositories/email-quote.repository';

interface Props {
  ticketId: string;
  /** The comment the email became, or null for the email that opened the ticket. */
  commentId: string | null;
  /** What the email carried besides the sender's words; nothing is kept when it is empty. */
  quoted: string;
  method: EmailQuoteMethod;
}

/** Keeps the part of an inbound email folded under its comment or description. */
export class KeepEmailQuote {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: EmailQuoteRepository,
  ) {}

  async execute(props: Props): Promise<void> {
    if (!props.quoted.trim()) return;
    await this.repository.create(new EmailQuote({
      id: this.idGenerator.create(),
      ticketId: props.ticketId,
      commentId: props.commentId,
      content: props.quoted,
      method: props.method,
    }));
  }
}
