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
