import { cutHtmlQuote } from '../email-reply-html-rules';
import { REPLY_MARKER, markerQuoteStart, textQuoteStart } from '../email-reply-text-rules';

/** How the reply was told apart from the quote, for the record. */
export type ReplyExtractionMethod = 'marker' | 'html' | 'text' | 'none';

export interface ExtractedReply {
  /** What the sender wrote: the comment. */
  reply: string;
  /** The rest of the email (the quoted message, the signature), kept to be shown on demand. */
  quoted: string;
  method: ReplyExtractionMethod;
}

interface Props {
  /** The email as plain text (its text part, or its HTML turned into text). */
  text: string;
  /** Its HTML part, when it has one: the quote is told apart by structure first. */
  html?: string | null;
}

/** The longest a reply or a kept quote can be; past it the text is cut, saying so. */
export const MAX_EMAIL_TEXT = 1024 * 1024;

const SIGNATURE = '\n-- \n';

function truncated(text: string): string {
  return text.length > MAX_EMAIL_TEXT ? `${text.slice(0, MAX_EMAIL_TEXT)}\n[…]` : text;
}

function splitAt(lines: string[], index: number): { reply: string; quoted: string } {
  return { reply: lines.slice(0, index).join('\n').trim(), quoted: lines.slice(index).join('\n').trim() };
}

/**
 * Separates what the sender of an emailed reply wrote from the message they answer, without
 * ever throwing anything away: the quote is kept, to be shown on demand. Used only for replies
 * to a ticket; the email that opens a ticket is taken whole (a forward is its content).
 *
 * In order, the first that holds:
 * 1. our own marker ("##- … -##" at the top of every email that can be answered), with the
 *    client's attribution or header block right above it;
 * 2. the quote container the mail client put in the HTML (Gmail, Outlook, Thunderbird, Apple…);
 * 3. strict text rules, in several languages (see email-reply-text-rules).
 * When the HTML and the text disagree widely, the cut that keeps more of the sender's text wins.
 * Nothing is cut when it would leave the reply empty. A signature after "-- " is folded with
 * the quote instead of being dropped.
 */
export class ExtractEmailReply {
  execute(props: Props): ExtractedReply {
    const text = props.text.replace(/\r\n?/g, '\n').trim();
    const lines = text.split('\n');

    const markerLine = lines.findIndex((line) => REPLY_MARKER.test(line));
    if (markerLine > 0) {
      const cut = splitAt(lines, markerQuoteStart(lines, markerLine));
      if (cut.reply) return this.finish(cut, 'marker');
    }

    const byHtml = props.html ? cutHtmlQuote(props.html) : null;
    const textStart = textQuoteStart(lines);
    const byText = textStart > 0 ? splitAt(lines, textStart) : null;

    if (byHtml && byText) {
      const keepsMore = byText.reply.length > byHtml.reply.length * 2 ? byText : byHtml;
      return this.finish(keepsMore, keepsMore === byHtml ? 'html' : 'text');
    }
    if (byHtml) return this.finish(byHtml, 'html');
    if (byText?.reply) return this.finish(byText, 'text');
    return this.finish({ reply: text, quoted: '' }, 'none');
  }

  /** The email that opens a ticket is its content: taken whole, only its signature folded. */
  keepWhole(text: string): ExtractedReply {
    return this.finish({ reply: text.replace(/\r\n?/g, '\n').trim(), quoted: '' }, 'none');
  }

  private finish(cut: { reply: string; quoted: string }, method: ReplyExtractionMethod): ExtractedReply {
    let { reply, quoted } = cut;
    const signature = reply.indexOf(SIGNATURE);
    if (signature > 0) {
      quoted = [reply.slice(signature + 1).trim(), quoted].filter(Boolean).join('\n\n');
      reply = reply.slice(0, signature).trim();
    }
    return { reply: truncated(reply), quoted: truncated(quoted), method };
  }
}
