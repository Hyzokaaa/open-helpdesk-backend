import { createHmac } from 'crypto';
import { WorkspaceTicketReference } from '../../workspace/domain/entities/workspace-ticket-reference';

/**
 * How a workspace shows its ticket references. The ticket always keeps its internal counter
 * (gap-free, per workspace); only what people see changes:
 *
 * - sequential: TK-000042, the counter itself.
 * - random: TK-7QX4M2K, the counter run through a keyed permutation, so references reveal
 *   neither how many tickets there are nor their order, and one cannot be guessed from another.
 *
 * Each ticket stores the reference it was created with (tickets.reference), so a later change of
 * format or prefix applies to new tickets only. Both formats are also reversible, which lets a
 * reference typed in a search find its ticket through the counter as well.
 */
export enum TicketReferenceStyle {
  SEQUENTIAL = 'sequential',
  RANDOM = 'random',
}

export interface TicketReferenceFormat {
  style: TicketReferenceStyle;
  prefix: string;
  /** The workspace's permutation key; only used, and only present, for random references. */
  secret: string | null;
}

export const DEFAULT_TICKET_REFERENCE_PREFIX = 'TK';

export const DEFAULT_TICKET_REFERENCE_FORMAT: TicketReferenceFormat = {
  style: TicketReferenceStyle.SEQUENTIAL,
  prefix: DEFAULT_TICKET_REFERENCE_PREFIX,
  secret: null,
};

/** The reference format a workspace has chosen; the default when it never changed it. */
export function ticketReferenceFormatOf(settings: WorkspaceTicketReference | null | undefined): TicketReferenceFormat {
  if (!settings) return DEFAULT_TICKET_REFERENCE_FORMAT;
  return {
    style: settings.style === TicketReferenceStyle.RANDOM ? TicketReferenceStyle.RANDOM : TicketReferenceStyle.SEQUENTIAL,
    prefix: settings.prefix || DEFAULT_TICKET_REFERENCE_PREFIX,
    secret: settings.secret,
  };
}

const MIN_DIGITS = 6;

/** No 0/O, 1/I/L: a reference read aloud or copied by hand stays unambiguous. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const BASE = ALPHABET.length; // 31
const CODE_LENGTH = 6;
/** Two halves of 31^3 each: the permutation covers 31^6 (about 887 million) tickets. */
const HALF = BASE ** 3;
const DOMAIN = HALF * HALF;
const ROUNDS = 8;

const PREFIX_PATTERN = /^[A-Z0-9]{1,10}$/;

/** A prefix as stored and shown: 1 to 10 letters or digits, upper case. Null when invalid. */
export function normalizeTicketReferencePrefix(prefix: string): string | null {
  const value = String(prefix ?? '').trim().toUpperCase();
  return PREFIX_PATTERN.test(value) ? value : null;
}

// ── Keyed permutation (balanced Feistel network over Z_HALF × Z_HALF) ──

function round(secret: string, roundIndex: number, half: number): number {
  const digest = createHmac('sha256', secret).update(`${roundIndex}:${half}`).digest();
  return digest.readUInt32BE(0) % HALF;
}

function permute(value: number, secret: string): number {
  let left = Math.floor(value / HALF);
  let right = value % HALF;
  for (let i = 0; i < ROUNDS; i++) {
    const next = (left + round(secret, i, right)) % HALF;
    left = right;
    right = next;
  }
  return left * HALF + right;
}

function unpermute(value: number, secret: string): number {
  let left = Math.floor(value / HALF);
  let right = value % HALF;
  for (let i = ROUNDS - 1; i >= 0; i--) {
    const previous = (right - round(secret, i, left) + HALF) % HALF;
    right = left;
    left = previous;
  }
  return left * HALF + right;
}

// ── Base-31 code with a check character (Luhn mod N) ──

function toCode(value: number): string {
  let code = '';
  let rest = value;
  for (let i = 0; i < CODE_LENGTH; i++) {
    code = ALPHABET[rest % BASE] + code;
    rest = Math.floor(rest / BASE);
  }
  return code;
}

function fromCode(code: string): number | null {
  let value = 0;
  for (const char of code) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return null;
    value = value * BASE + digit;
  }
  return value;
}

/** Catches a mistyped character or two swapped neighbours before they lead to another ticket. */
function checkCharacter(code: string): string {
  let factor = 2;
  let sum = 0;
  for (let i = code.length - 1; i >= 0; i--) {
    let addend = factor * ALPHABET.indexOf(code[i]);
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / BASE) + (addend % BASE);
    sum += addend;
  }
  return ALPHABET[(BASE - (sum % BASE)) % BASE];
}

/**
 * The reference a stored ticket shows: the one fixed when it was created. Every ticket has one;
 * the fallback only covers an object built without it.
 */
export function ticketReferenceOf(ticket: { reference: string | null; ticketNumber: number }): string {
  return ticket.reference ?? formatTicketReference(ticket.ticketNumber, DEFAULT_TICKET_REFERENCE_FORMAT);
}

// ── Formatting and reading ──

function sequential(prefix: string, ticketNumber: number): string {
  const digits = String(Math.max(0, Math.trunc(ticketNumber)));
  // The padding is a minimum, not a fixed width: past 999999 the reference just grows
  return `${prefix}-${digits.padStart(MIN_DIGITS, '0')}`;
}

/** The reference people see for a ticket of a workspace with this format. */
export function formatTicketReference(ticketNumber: number, format: TicketReferenceFormat = DEFAULT_TICKET_REFERENCE_FORMAT): string {
  const prefix = format.prefix || DEFAULT_TICKET_REFERENCE_PREFIX;
  const value = Math.trunc(ticketNumber);
  // Past the permutation's range (887 million tickets) a workspace falls back to its counter
  if (format.style !== TicketReferenceStyle.RANDOM || !format.secret || value < 0 || value >= DOMAIN) {
    return sequential(prefix, value);
  }
  const code = toCode(permute(value, format.secret));
  return `${prefix}-${code}${checkCharacter(code)}`;
}

const COUNTER_TERM = /^0*(\d{1,9})$/;
const CODE_TERM = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH + 1}}$`);

/**
 * Reads a search term as a ticket reference of this workspace and returns its internal counter,
 * or null when the term is not one (callers then search by text). Accepts the counter in any of
 * its forms ('TK-000042', '42'), so references from before a format change are still found, and,
 * for random references, the code with or without its prefix. Only this workspace's prefix, or
 * the default one, is recognised. A code whose check character does not match is not a reference.
 */
export function parseTicketReference(term: string, format: TicketReferenceFormat = DEFAULT_TICKET_REFERENCE_FORMAT): number | null {
  const value = String(term ?? '').trim().toUpperCase();
  if (!value) return null;

  // The term itself, and what is left after each prefix it may start with
  const candidates = [value];
  for (const prefix of new Set([format.prefix || DEFAULT_TICKET_REFERENCE_PREFIX, DEFAULT_TICKET_REFERENCE_PREFIX])) {
    if (value.startsWith(prefix)) candidates.push(value.slice(prefix.length).replace(/^[-\s]/, ''));
  }

  // A code can be made only of digits (2-9), so under random references a valid code is read
  // as a code first; its check character makes a typed counter pass for one very unlikely
  if (format.style === TicketReferenceStyle.RANDOM && format.secret) {
    for (const candidate of candidates) {
      if (!CODE_TERM.test(candidate)) continue;
      const code = candidate.slice(0, CODE_LENGTH);
      if (candidate[CODE_LENGTH] !== checkCharacter(code)) continue;
      const permuted = fromCode(code);
      if (permuted === null) continue;
      const n = unpermute(permuted, format.secret);
      if (n > 0) return n;
    }
  }

  for (const candidate of candidates) {
    const counter = COUNTER_TERM.exec(candidate);
    if (!counter) continue;
    const n = Number(counter[1]);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  return null;
}
