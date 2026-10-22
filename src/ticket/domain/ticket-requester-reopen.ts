import { Ticket } from './entities/ticket';
import { TicketStatus } from './enums/ticket-status.enum';
import { REQUESTER_REOPEN_DAYS } from './services/ticket-reopen';

/** Until when the requester can reopen it from the portal, while resolved; null when they cannot. */
export function requesterReopenUntil(ticket: Ticket, viewerId: string, now = new Date()): string | null {
  if (ticket.status !== TicketStatus.RESOLVED || !ticket.resolvedAt || ticket.reporterId !== viewerId) return null;
  const until = new Date(ticket.resolvedAt.getTime() + REQUESTER_REOPEN_DAYS * 24 * 3600 * 1000);
  return until > now ? until.toISOString() : null;
}
