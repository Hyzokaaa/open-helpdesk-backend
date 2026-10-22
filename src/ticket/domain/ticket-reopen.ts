import { TicketReopenReason } from './enums/ticket-reopen-reason.enum';
import { TicketStatus } from './enums/ticket-status.enum';

/**
 * The last time a ticket was reopened, kept on the ticket so its header can always say it (the
 * activity tab is not on every plan): who and when, why, and who had closed it.
 */
export interface TicketReopen {
  byId: string;
  at: string;
  reason: TicketReopenReason;
  /** What the team wrote, or the requester's message; seen by the team only. */
  note: string;
  fromStatus: TicketStatus.RESOLVED | TicketStatus.DISCARDED;
  /** Who had resolved it and when; null when it was discarded without being resolved. */
  previousResolvedById: string | null;
  previousResolvedAt: string | null;
}
