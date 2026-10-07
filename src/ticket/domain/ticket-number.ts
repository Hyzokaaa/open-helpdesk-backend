import { DEFAULT_TICKET_REFERENCE_FORMAT, formatTicketReference, parseTicketReference } from './ticket-reference';

// The default reference format (TK-000042). Code that knows the workspace uses
// formatTicketReference / parseTicketReference with that workspace's format instead.

export function formatTicketNumber(ticketNumber: number): string {
  return formatTicketReference(ticketNumber, DEFAULT_TICKET_REFERENCE_FORMAT);
}

// Reads a search term as a ticket reference, accepting the formatted value
// ('TK-000042'), the bare counter ('42') and the variations in between.
// Returns null when the term is not a reference, so callers fall back to text.
export function parseTicketNumber(search: string): number | null {
  return parseTicketReference(search, DEFAULT_TICKET_REFERENCE_FORMAT);
}
