import { MtaHookPayload } from '../../infrastructure/nest/dto/mta-hook-payload.dto';

export interface ParsedInboundEmail {
  fromAddress: string;
  toAddresses: string[];
  subject: string;
  body: string;
  inReplyToTicketId: string | null;
}

export class ParseInboundEmail {
  constructor(private readonly emailDomain: string) {}

  execute(payload: MtaHookPayload): ParsedInboundEmail {
    const fromAddress = payload.envelope.from.address.toLowerCase();
    const toAddresses = payload.envelope.to.map((t) => t.address.toLowerCase());

    const subject = this.findHeader(payload.message.headers, 'subject') || '(No subject)';
    const inReplyTo = this.findHeader(payload.message.headers, 'in-reply-to');

    let inReplyToTicketId: string | null = null;
    if (inReplyTo) {
      const escaped = this.emailDomain.replace(/\./g, '\\.');
      const match = inReplyTo.match(new RegExp(`<ticket-([a-zA-Z0-9]+)@${escaped}>`));
      if (match) {
        inReplyToTicketId = match[1];
      }
    }

    const body = this.extractBody(payload.message.contents);

    return {
      fromAddress,
      toAddresses,
      subject,
      body: body || '(No content)',
      inReplyToTicketId,
    };
  }

  private findHeader(headers: [string, string][], name: string): string | null {
    const lower = name.toLowerCase();
    for (const [key, value] of headers) {
      if (key.toLowerCase() === lower) return value;
    }
    return null;
  }

  private extractBody(contents: string): string {
    if (!contents) return '';

    let text = contents;

    // Strip HTML tags if present
    if (text.includes('<html') || text.includes('<body') || text.includes('<div')) {
      text = text
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

    // Strip quoted replies (lines starting with >)
    text = text
      .split('\n')
      .filter((line) => !line.startsWith('>'))
      .join('\n');

    // Strip content after "On ... wrote:" pattern
    text = text.replace(/\n\s*On .+wrote:\s*$/s, '');

    // Strip email signatures (after -- on its own line)
    const sigIndex = text.indexOf('\n-- \n');
    if (sigIndex > 0) {
      text = text.substring(0, sigIndex);
    }

    // Clean up whitespace
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    // Truncate
    if (text.length > 10000) {
      text = text.substring(0, 10000);
    }

    return text;
  }
}
