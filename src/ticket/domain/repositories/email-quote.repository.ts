import { EmailQuote } from '../entities/email-quote';

export interface EmailQuoteSummary {
  /** Null for the ticket's description. */
  commentId: string | null;
  lineCount: number;
}

export interface EmailQuoteRepository {
  create(quote: EmailQuote): Promise<void>;
  /** The quote under a comment, or under the description when commentId is null. */
  findByTicketAndComment(ticketId: string, commentId: string | null): Promise<EmailQuote | null>;
  /** Which parts of the ticket have a folded quote, and how long it is, without the text. */
  findSummariesByTicketId(ticketId: string): Promise<EmailQuoteSummary[]>;
  findByTicketIds(ticketIds: string[]): Promise<EmailQuote[]>;
}
