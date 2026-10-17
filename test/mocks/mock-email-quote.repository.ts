import { EmailQuote } from '../../src/ticket/domain/entities/email-quote';
import { EmailQuoteRepository, EmailQuoteSummary } from '../../src/ticket/domain/repositories/email-quote.repository';

export class MockEmailQuoteRepository implements EmailQuoteRepository {
  readonly quotes: EmailQuote[] = [];

  async create(quote: EmailQuote): Promise<void> {
    this.quotes.push(quote);
  }

  async findByTicketAndComment(ticketId: string, commentId: string | null): Promise<EmailQuote | null> {
    return this.quotes.find((q) => q.ticketId === ticketId && q.commentId === commentId) ?? null;
  }

  async findSummariesByTicketId(ticketId: string): Promise<EmailQuoteSummary[]> {
    return this.quotes.filter((q) => q.ticketId === ticketId).map((q) => ({ commentId: q.commentId, lineCount: q.lineCount() }));
  }

  async findByTicketIds(ticketIds: string[]): Promise<EmailQuote[]> {
    return this.quotes.filter((q) => ticketIds.includes(q.ticketId));
  }
}
