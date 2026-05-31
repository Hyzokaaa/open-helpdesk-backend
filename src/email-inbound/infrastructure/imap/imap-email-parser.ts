import { ParsedInboundEmail } from '../../domain/services/parse-inbound-email';

const TICKET_ID_REGEX_TEMPLATE = '<ticket-([a-zA-Z0-9]+)@EMAIL_DOMAIN>';

export class ImapEmailParser {
  private readonly ticketIdRegex: RegExp;

  constructor(private readonly emailDomain: string) {
    const escaped = emailDomain.replace(/\./g, '\\.');
    this.ticketIdRegex = new RegExp(TICKET_ID_REGEX_TEMPLATE.replace('EMAIL_DOMAIN', escaped));
  }

  parse(envelope: ImapEnvelope, bodyText: string): ParsedInboundEmail {
    const fromAddress = (envelope.from ?? '').toLowerCase();
    const toAddresses = (envelope.to ?? []).map((a) => a.toLowerCase());
    const subject = envelope.subject || '(No subject)';

    let inReplyToTicketId: string | null = null;
    if (envelope.inReplyTo) {
      const match = envelope.inReplyTo.match(this.ticketIdRegex);
      if (match) {
        inReplyToTicketId = match[1];
      }
    }

    const body = this.cleanBody(bodyText);

    return {
      fromAddress,
      toAddresses,
      subject,
      body: body || '(No content)',
      inReplyToTicketId,
    };
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
  subject: string;
  messageId: string;
  inReplyTo?: string;
}
