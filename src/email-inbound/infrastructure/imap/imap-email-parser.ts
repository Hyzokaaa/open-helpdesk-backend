import { ParsedInboundEmail, ParsedAttachment } from '../../domain/services/parse-inbound-email';

const TICKET_ID_REGEX_TEMPLATE = '<ticket-([a-zA-Z0-9]+)@EMAIL_DOMAIN>';

export class ImapEmailParser {
  private readonly ticketIdRegex: RegExp;

  constructor(private readonly emailDomain: string) {
    const escaped = emailDomain.replace(/\./g, '\\.');
    this.ticketIdRegex = new RegExp(TICKET_ID_REGEX_TEMPLATE.replace('EMAIL_DOMAIN', escaped));
  }

  async parse(envelope: ImapEnvelope, rawMime: string): Promise<ParsedInboundEmail> {
    const fromAddress = (envelope.from ?? '').toLowerCase();
    const toAddresses = [
      ...(envelope.to ?? []),
      ...(envelope.cc ?? []),
    ].map((a) => a.toLowerCase());
    const subject = envelope.subject || '(No subject)';

    let inReplyToTicketId: string | null = null;
    if (envelope.inReplyTo) {
      const match = envelope.inReplyTo.match(this.ticketIdRegex);
      if (match) {
        inReplyToTicketId = match[1];
      }
    }

    const { body, attachments } = await this.parseRawMime(rawMime);

    return {
      fromAddress,
      toAddresses,
      subject,
      body: body || '(No content)',
      inReplyToTicketId,
      attachments,
    };
  }

  private async parseRawMime(raw: string): Promise<{ body: string; attachments: ParsedAttachment[] }> {
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

      return { body, attachments };
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

    // Strip quoted replies
    cleaned = cleaned
      .split('\n')
      .filter((line) => !line.startsWith('>'))
      .join('\n');

    // Strip "On ... wrote:" pattern
    cleaned = cleaned.replace(/\n\s*On .+wrote:\s*$/s, '');

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
  to: string[];
  cc: string[];
  subject: string;
  messageId: string;
  inReplyTo?: string;
}
