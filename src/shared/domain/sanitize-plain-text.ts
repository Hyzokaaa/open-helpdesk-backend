import { decodeEntities } from './sanitize-html';

/**
 * Code points that render as nothing yet change how text or a URL is read: ASCII controls,
 * C1 controls, zero-width characters, bidi embeddings/overrides/isolates and the byte order mark.
 * Built from numbers rather than escapes so the source stays readable and free of literal
 * line/paragraph separators.
 */
const INVISIBLE_RANGES: Array<[number, number]> = [
  [0x00, 0x1f], // C0 controls (tab, newline and carriage return included)
  [0x7f, 0x9f], // DEL and C1 controls
  [0x200b, 0x200f], // zero-width space/joiners, bidi marks
  [0x2028, 0x202e], // line/paragraph separators, bidi embeddings and overrides
  [0x2060, 0x2064], // word joiner and invisible operators
  [0x2066, 0x2069], // bidi isolates
  [0xfeff, 0xfeff], // byte order mark
];

function charClass(ranges: Array<[number, number]>): string {
  return ranges.map(([from, to]) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`).join('');
}

/** Matches every invisible character listed above. */
export const INVISIBLE_CHARS = new RegExp(`[${charClass(INVISIBLE_RANGES)}]`, 'g');

/** Same as INVISIBLE_CHARS plus the ASCII space, for places where whitespace itself is ignored (URLs). */
export const INVISIBLE_CHARS_AND_SPACE = new RegExp(`[${charClass([[0x00, 0x20], ...INVISIBLE_RANGES.slice(1)])}]`, 'g');

const HTML_TAG = /<[^>]*>?/g;

/**
 * Reduces free text that will be shown as-is (names, labels) to plain text: strips HTML tags and
 * stray angle brackets, removes invisible and control characters, collapses whitespace and trims.
 * An optional maximum length truncates the result.
 */
export function sanitizePlainText(input: string, maxLength?: number): string {
  const cleaned = input
    .replace(HTML_TAG, '')
    .replace(/[<>]/g, '')
    .replace(INVISIBLE_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return maxLength !== undefined ? cleaned.slice(0, maxLength).trim() : cleaned;
}

/**
 * Keeps text on a single line for places that are plain text but line-sensitive, such as an email
 * subject header: line breaks and invisible characters become spaces. Unlike `sanitizePlainText`
 * it keeps angle brackets, since the result is never read as HTML.
 */
export function singleLineText(input: string): string {
  return input.replace(INVISIBLE_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Converts rich-text (HTML) content to readable plain text, keeping line breaks: block boundaries
 * become newlines, every tag is removed, entities are decoded, invisible and control characters
 * are dropped and runs of blank lines collapse. An optional maximum length truncates the result
 * (with an ellipsis) after the tags are gone, so a cut can never leave a partial tag behind.
 *
 * The result is plain text and must still be escaped before it is placed inside HTML.
 */
export function htmlToPlainText(input: string, maxLength?: number): string {
  let text = input.replace(/\r\n?/g, '\n');

  // Content that is never meant to be read.
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Block boundaries become newlines.
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|li|div|h[1-6]|blockquote|pre|tr)\s*>/gi, '\n');

  // Strip every remaining tag, including an unterminated one at the end.
  text = text.replace(/<[a-z/!][^>]*>?/gi, '');

  // Decode after stripping, so encoded text such as "&lt;b&gt;" survives as literal text.
  text = decodeEntities(text);

  text = text
    .split('\n')
    .map((line) => line.replace(INVISIBLE_CHARS, ' ').replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (maxLength !== undefined && text.length > maxLength) {
    return text.slice(0, maxLength).trimEnd() + '...';
  }
  return text;
}
