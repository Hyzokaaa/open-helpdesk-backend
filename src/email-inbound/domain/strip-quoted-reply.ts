/**
 * Cuts an emailed reply where the quote of the message it answers begins, so a ticket keeps
 * what the person wrote and not the whole thread again. Mail clients mark the quote in their
 * own way and language:
 *
 * - Gmail and Apple Mail: "On Mon, 12 Oct 2026, Ana <a@x.com> wrote:" / "El lun, … escribió:",
 *   sometimes wrapped over two lines;
 * - Thunderbird in Spanish: "En 14/10/2026 12:35, Ana escribió:";
 * - Outlook: a line of underscores, or a "From:/De:" header block followed by "Sent:/Enviado:";
 * - older clients: "-----Original Message-----" / "-----Mensaje original-----".
 *
 * Lines quoted with ">" are dropped as well. When the quote is all there is, the text is kept.
 */

const ATTRIBUTION_START = /^\s*(on|el|en)\s.+/i;
const ATTRIBUTION_END = /(wrote|escribió|escribio)\s*:\s*$/i;
const UNDERSCORE_RULE = /^\s*_{10,}\s*$/;
const ORIGINAL_MESSAGE = /^\s*-{2,}\s*(original message|mensaje original)\s*-{2,}\s*$/i;
const HEADER_FROM = /^\s*\*?(from|de)\s*:\*?\s+\S/i;
const HEADER_SENT = /^\s*\*?(sent|enviado|date|fecha)\s*:\*?\s+\S/i;

function quoteStart(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (UNDERSCORE_RULE.test(line) || ORIGINAL_MESSAGE.test(line)) return i;
    if (ATTRIBUTION_START.test(line) && ATTRIBUTION_END.test(line)) return i;
    if (ATTRIBUTION_START.test(line) && i + 1 < lines.length && ATTRIBUTION_END.test(lines[i + 1])) return i;
    if (HEADER_FROM.test(line) && lines.slice(i + 1, i + 5).some((next) => HEADER_SENT.test(next))) return i;
  }
  return -1;
}

export function stripQuotedReply(text: string): string {
  const lines = text.split('\n');
  const start = quoteStart(lines);
  const kept = (start >= 0 ? lines.slice(0, start) : lines).filter((line) => !line.startsWith('>'));
  const result = kept.join('\n').trim();
  return result || text.trim();
}
