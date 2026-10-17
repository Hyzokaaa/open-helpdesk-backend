/**
 * Text rules that find where the quote of an emailed reply begins. They are strict on purpose:
 * cutting a customer's own words is worse than leaving a quote in, so each rule asks for the
 * shape mail clients really write, in the languages our customers use, and not just a word.
 *
 * Multilingual words adapted from crisp-oss/email-reply-parser (MIT).
 */

/** Our own boundary, at the top of every email that can be answered: "##- … -##". */
export const REPLY_MARKER = /^[\s>]*##-.{3,120}-##\s*$/;

/** How an attribution line starts: "On", "El", "Le", "Am", "Em", "Il giorno", "Op", "Den"… */
const ATTRIBUTION_START = /^\s*(on|el|en|le|am|em|il|op|den|w dniu|dne|pe)\s/i;

/** The verb that ends it, before the closing colon: "wrote:", "escribió:", "a écrit :", "schrieb Ana <a@x>:"… */
// Explicit boundaries: \b does not see accented letters ("escribió") as part of a word
const ATTRIBUTION_VERB = /(^|[\s,])(wrote|escribió|escribio|a écrit|a ecrit|schrieb|escreveu|ha scritto|schreef|skrev|napisał|napisal|kirjoitti|írta)(?=[\s:]|$)/i;

/** A date, a time or an address: every real attribution names when or who. */
const DATE_OR_ADDRESS = /@|\d{1,4}[:/.\-]\d{1,2}|\d{4}/;

/** The first line of an Outlook header block: "From: Ana <a@x.com>", "De : …", "Von: …". */
const HEADER_FROM = /^\s*\*?(from|de|von|van|da|od|från|fra|lähettäjä)\s*\*?\s*:\*?\s*\S/i;

/** The other fields of that block. */
const HEADER_FIELD = /^\s*\*?(sent|date|to|cc|subject|enviado|fecha|para|asunto|gesendet|datum|an|betreff|envoyé|envoye|à|a|objet|verzonden|aan|onderwerp|inviato|data|oggetto|enviada|assunto|skickat|ämne|till)\s*\*?\s*:\*?\s*\S/i;

const UNDERSCORE_RULE = /^\s*_{10,}\s*$/;

const ORIGINAL_MESSAGE = /^\s*-{2,}\s*(original message|mensaje original|ursprüngliche nachricht|message d'origine|oorspronkelijk bericht|messaggio originale|mensagem original|originalmeddelande)\s*-{2,}\s*$/i;

const QUOTED = /^\s*>/;
const BLANK = /^\s*$/;

/** An attribution on line i, alone or wrapped over two lines; returns how many lines it takes. */
export function attributionAt(lines: string[], i: number): number {
  if (!ATTRIBUTION_START.test(lines[i])) return 0;
  for (const span of [1, 2]) {
    const joined = lines.slice(i, i + span).join(' ').trim();
    if (joined.length <= 300 && joined.endsWith(':') && ATTRIBUTION_VERB.test(joined) && DATE_OR_ADDRESS.test(joined)) return span;
  }
  return 0;
}

/** An Outlook header block starting on line i: a From line with an address, or with 3 more fields. */
export function headerBlockAt(lines: string[], i: number): boolean {
  if (!HEADER_FROM.test(lines[i])) return false;
  const fields = lines.slice(i + 1, i + 6).filter((l) => HEADER_FIELD.test(l)).length;
  const hasAddress = /@|<[^>]+>/.test(lines[i]);
  return (hasAddress && fields >= 2) || fields >= 3;
}

/** True when everything from line i on is quoted with ">" or blank: nobody wrote below it. */
export function onlyQuotesFrom(lines: string[], i: number): boolean {
  let quoted = 0;
  for (const line of lines.slice(i)) {
    if (BLANK.test(line)) continue;
    if (!QUOTED.test(line)) return false;
    quoted++;
  }
  return quoted > 0;
}

/** A line a mail client writes to open a quote: attribution, header block, rule or "Original Message". */
function isBlockStart(lines: string[], i: number): boolean {
  return attributionAt(lines, i) > 0 || headerBlockAt(lines, i) || UNDERSCORE_RULE.test(lines[i]) || ORIGINAL_MESSAGE.test(lines[i]);
}

/**
 * Where the quote begins by text alone, or -1. Candidates, the first that holds:
 * - an attribution followed only by ">" lines (so "como el técnico escribió:" in the middle of a
 *   message never cuts, and an answer written between quoted lines keeps everything);
 * - an Outlook header block (with "-----Original Message-----" or a rule of underscores above it);
 * - a trailing block of ">" lines, with nothing written after it.
 */
export function textQuoteStart(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const span = attributionAt(lines, i);
    if (span && onlyQuotesFrom(lines, i + span)) return i;

    if (headerBlockAt(lines, i)) {
      let start = i;
      while (start > 0 && (BLANK.test(lines[start - 1]) || UNDERSCORE_RULE.test(lines[start - 1]) || ORIGINAL_MESSAGE.test(lines[start - 1]))) start--;
      return start;
    }
    // A rule or "Original Message" is a client's own line: a From line right below is enough
    if ((UNDERSCORE_RULE.test(lines[i]) || ORIGINAL_MESSAGE.test(lines[i])) && lines.slice(i + 1, i + 3).some((line) => HEADER_FROM.test(line))) {
      const from = lines.slice(i + 1, i + 3).findIndex((line) => HEADER_FROM.test(line)) + i + 1;
      const fields = lines.slice(from + 1, from + 6).filter((l) => HEADER_FIELD.test(l)).length;
      if (ORIGINAL_MESSAGE.test(lines[i]) || (/@|<[^>]+>/.test(lines[from]) && fields >= 1)) return i;
    }

    if (QUOTED.test(lines[i]) && onlyQuotesFrom(lines, i)) return i;
  }
  return -1;
}

/**
 * Where to cut above our own marker on line m: the marker proves all below is our email, so the
 * client's attribution or header block right above it goes too. Only blank and header lines are
 * crossed, at most 10, and only up to a real block start; otherwise the cut stays at the marker.
 */
export function markerQuoteStart(lines: string[], m: number): number {
  let blockStart = -1;
  for (let i = m - 1; i >= 0 && i >= m - 10; i--) {
    const line = lines[i];
    if (BLANK.test(line)) continue;
    if (isBlockStart(lines, i) || (i > 0 && attributionAt(lines, i - 1) === 2)) {
      blockStart = attributionAt(lines, i - 1) === 2 ? i - 1 : i;
      continue;
    }
    if (HEADER_FIELD.test(line) && blockStart === -1) continue;
    break;
  }
  if (blockStart === -1) return m;
  // A rule of underscores or "Original Message" right above the block belongs to it
  let start = blockStart;
  while (start > 0 && (BLANK.test(lines[start - 1]) || UNDERSCORE_RULE.test(lines[start - 1]) || ORIGINAL_MESSAGE.test(lines[start - 1]))) start--;
  return start;
}
