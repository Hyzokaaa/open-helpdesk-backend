const PREFIX = 'TK';
const MIN_DIGITS = 6;

// The padding is a minimum, not a fixed width: workspaces past 999999 tickets
// keep growing (TK-1000000) instead of overflowing the format.
export function formatTicketNumber(ticketNumber: number): string {
  const digits = String(Math.max(0, Math.trunc(ticketNumber)));
  return `${PREFIX}-${digits.padStart(MIN_DIGITS, '0')}`;
}

const REFERENCE = /^(?:tk[-\s]?)?0*(\d{1,9})$/i;

// Reads a search term as a ticket reference, accepting the formatted value
// ('TK-000042'), the bare counter ('42') and the variations in between.
// Returns null when the term is not a reference, so callers fall back to text.
export function parseTicketNumber(search: string): number | null {
  const match = REFERENCE.exec(search.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
