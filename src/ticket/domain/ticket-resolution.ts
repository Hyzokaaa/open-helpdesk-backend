import { Ticket } from './entities/ticket';
import { TicketStatus } from './enums/ticket-status.enum';

export const CLOSED_STATUSES: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.DISCARDED];

export function isClosedStatus(status: TicketStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

/** Marks who resolved it and when; the first resolution is kept apart, for good. */
export function markResolved(ticket: Ticket, userId: string, at = new Date()): void {
  ticket.status = TicketStatus.RESOLVED;
  ticket.resolvedAt = at;
  ticket.resolvedById = userId;
  ticket.discardReason = null;
  if (!ticket.firstResolvedAt) ticket.firstResolvedAt = at;
}
