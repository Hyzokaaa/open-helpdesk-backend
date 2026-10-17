import { extractThreadIds, ThreadIds } from '../../../email/domain/ticket-email-thread';
import { htmlToText } from '../../domain/email-reply-html-rules';

export interface ParsedInboundEmail {
  fromAddress: string;
  fromName?: string;
  toAddresses: string[];
  subject: string;
  /**
   * The whole email as plain text, quote and signature included: telling what the sender wrote
   * apart from the quote is the domain's job, and only for replies (see ExtractEmailReply).
   */
  body: string;
  /** The HTML part, when the email has one: the quote is found by its structure first. */
  html?: string;
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

    const { body, html, attachments, inReplyTo, references } = await this.parseRawMime(rawMime);
    // The answered message is in In-Reply-To; References holds the rest of the thread
    const thread = extractThreadIds(envelope.inReplyTo, inReplyTo, references);

    return {
      fromAddress,
      fromName: envelope.fromName || undefined,
      toAddresses,
      subject,
      body: body || '(No content)',
      ...(html ? { html } : {}),
      thread,
      attachments,
      date: envelope.date ?? undefined,
    };
  }

  private async parseRawMime(raw: string): Promise<{
    body: string;
    html?: string;
    attachments: ParsedAttachment[];
    inReplyTo?: string;
    references?: string | string[];
  }> {
    try {
      const { simpleParser } = require('mailparser');
      const parsed = await simpleParser(raw);

      const html = typeof parsed.html === 'string' && parsed.html.trim() ? parsed.html : undefined;
      const body = this.cleanBody(parsed.text || (html ? htmlToText(html) : raw));
      const attachments: ParsedAttachment[] = (parsed.attachments ?? []).map((att: any) => ({
        filename: att.filename || 'attachment',
        mimeType: att.contentType || 'application/octet-stream',
        size: att.size || att.content?.length || 0,
        content: att.content,
      }));

      return { body, html, attachments, inReplyTo: parsed.inReplyTo, references: parsed.references };
    } catch {
      return { body: this.cleanBody(raw), attachments: [] };
    }
  }

  /** Line endings and blank lines tidied; nothing the sender wrote or quoted is removed. */
  private cleanBody(text: string): string {
    if (!text) return '';
    const plain = /<(html|body|div|p)[\s>]/i.test(text) ? htmlToText(text) : text;
    return plain
      .replace(/\r\n?/g, '\n')
      // Trailing spaces go, except the one of the signature separator "-- " (RFC 3676)
      .replace(/^(?!-- $)(.*?)[ \t]+$/gm, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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
