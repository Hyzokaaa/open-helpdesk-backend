import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { EmailQuote, EmailQuoteMethod } from '../../../domain/entities/email-quote';
import { EmailQuoteRepository, EmailQuoteSummary } from '../../../domain/repositories/email-quote.repository';
import { EmailQuoteModel } from '../models/email-quote.model';

@Injectable()
export class TypeOrmEmailQuoteRepository implements EmailQuoteRepository {
  constructor(
    @InjectRepository(EmailQuoteModel)
    private readonly repository: Repository<EmailQuoteModel>,
  ) {}

  async create(quote: EmailQuote): Promise<void> {
    await this.repository.insert({
      id: quote.getId(),
      ticketId: quote.ticketId,
      commentId: quote.commentId,
      content: quote.content,
      lineCount: quote.lineCount(),
      method: quote.method,
    });
  }

  async findByTicketAndComment(ticketId: string, commentId: string | null): Promise<EmailQuote | null> {
    const row = await this.repository.findOneBy({ ticketId, commentId: commentId ?? IsNull() });
    return row ? this.toDomain(row) : null;
  }

  async findSummariesByTicketId(ticketId: string): Promise<EmailQuoteSummary[]> {
    const rows = await this.repository.find({ where: { ticketId }, select: ['commentId', 'lineCount'] });
    return rows.map((r) => ({ commentId: r.commentId, lineCount: r.lineCount }));
  }

  async findByTicketIds(ticketIds: string[]): Promise<EmailQuote[]> {
    if (ticketIds.length === 0) return [];
    const rows = await this.repository.find({ where: { ticketId: In(ticketIds) } });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: EmailQuoteModel): EmailQuote {
    return new EmailQuote({ id: row.id, ticketId: row.ticketId, commentId: row.commentId, content: row.content, method: row.method as EmailQuoteMethod });
  }
}
