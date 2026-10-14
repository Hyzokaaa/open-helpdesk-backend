import { extractThreadIds, ThreadIds } from '../../../email/domain/ticket-email-thread';
import { stripQuotedReply } from '../../domain/strip-quoted-reply';

export interface ParsedInboundEmail {
  fromAddress: string;
  fromName?: string;
  toAddresses: string[];
  subject: string;
  body: string;
  /** Ticket and comment ids of the thread the email replies to; empty for a new conversation. */
  thread: ThreadIds;
  attachments: ParsedAttachment[];
  mailboxId?: string;
  date?: Date;
}

export interface ParsedAttachment {
  filename: string;
  mimeType: string;
  size: number;
  content: Buffer;
}

export class ImapEmailParser {
  async parse(envelope: ImapEnvelope, rawMime: string): Promise<ParsedInboundEmail> {
    const fromAddress = (envelope.from ?? '').toLowerCase();
    const toAddresses = [
      ...(envelope.to ?? []),
      ...(envelope.cc ?? []),
    ].map((a) => a.toLowerCase());
    const subject = envelope.subject || '(No subject)';

    const { body, attachments, inReplyTo, references } = await this.parseRawMime(rawMime);
    // The answered message is in In-Reply-To; References holds the rest of the thread
    const thread = extractThreadIds(envelope.inReplyTo, inReplyTo, references);

    return {
      fromAddress,
      fromName: envelope.fromName || undefined,
      toAddresses,
      subject,
      body: body || '(No content)',
      thread,
      attachments,
      date: envelope.date ?? undefined,
    };
  }

  private async parseRawMime(raw: string): Promise<{
    body: string;
    attachments: ParsedAttachment[];
    inReplyTo?: string;
    references?: string | string[];
  }> {
    try {
      const { simpleParser } = require('mailparser');
      const parsed = await simpleParser(raw);

      const body = this.cleanBody(parsed.text || parsed.html || raw);
      const attachments: ParsedAttachment[] = (parsed.attachments ?? []).map((att: any) => ({
        filename: att.filename || 'attachment',
        mimeType: att.contentType || 'application/octet-stream',
        size: att.size || att.content?.length || 0,
        content: att.content,
      }));

      return { body, attachments, inReplyTo: parsed.inReplyTo, references: parsed.references };
    } catch {
      return { body: this.cleanBody(raw), attachments: [] };
    }
  }

  private cleanBody(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // Strip HTML if present
    if (cleaned.includes('<html') || cleaned.includes('<body') || cleaned.includes('<div')) {
      cleaned = cleaned
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#x27;/gi, "'");
    }

    // Keep what the person wrote, not the quote of the message they answer
    cleaned = stripQuotedReply(cleaned);

    // Strip signatures
    const sigIndex = cleaned.indexOf('\n-- \n');
    if (sigIndex > 0) {
      cleaned = cleaned.substring(0, sigIndex);
    }

    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    if (cleaned.length > 10000) {
      cleaned = cleaned.substring(0, 10000);
    }

    return cleaned;
  }
}

export interface ImapEnvelope {
  from: string;
  fromName?: string;
  to: string[];
  cc: string[];
  subject: string;
  messageId: string;
  inReplyTo?: string;
  date?: Date;
}
