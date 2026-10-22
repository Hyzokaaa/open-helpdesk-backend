import { DomainValidationError } from '../../shared/domain/errors';
import { TicketStatus } from './enums/ticket-status.enum';

/*
 * How status and assignee fit together: Open is the queue, where nobody has it, while Pending and
 * In progress are somebody's work. Resolved and Discarded take either. Every action that touches
 * one of the two goes through here, so the board, the ticket, the list and the API agree.
 */

/** Somebody's work: these statuses always have an assignee. */
export const WORK_STATUSES: TicketStatus[] = [TicketStatus.PENDING, TicketStatus.IN_PROGRESS];

/** Said when work is asked for with nobody to do it, and nobody can be taken for it. */
export const NEEDS_ASSIGNEE_MESSAGE = 'A pending or in-progress ticket needs somebody assigned: assign it first';
const QUEUE_TAKES_NOBODY_MESSAGE = 'An open ticket is in the queue: it has nobody assigned';

export function isWorkStatus(status: TicketStatus): boolean {
  return WORK_STATUSES.includes(status);
}

/** Both asked for at once, explicitly: they must fit, or it is a 400. */
export function ensureAssignmentFits(status: TicketStatus, assigneeId: string | null): void {
  if (status === TicketStatus.OPEN && assigneeId) throw new DomainValidationError(QUEUE_TAKES_NOBODY_MESSAGE);
  if (isWorkStatus(status) && !assigneeId) throw new DomainValidationError(NEEDS_ASSIGNEE_MESSAGE);
}

/**
 * Both chosen, but the assignee may have dropped out (no longer on the team): work with nobody to
 * do it falls back to the queue. Asking for the queue with somebody is still a contradiction.
 */
export function settleAssignment(status: TicketStatus, assigneeId: string | null): TicketStatus {
  if (status === TicketStatus.OPEN && assigneeId) throw new DomainValidationError(QUEUE_TAKES_NOBODY_MESSAGE);
  if (isWorkStatus(status) && !assigneeId) return TicketStatus.OPEN;
  return status;
}

/** Only the assignee changes: somebody takes a queued ticket to Pending, nobody sends work back to the queue. */
export function statusForAssignee(status: TicketStatus, assigneeId: string | null): TicketStatus {
  if (status === TicketStatus.OPEN && assigneeId) return TicketStatus.PENDING;
  if (isWorkStatus(status) && !assigneeId) return TicketStatus.OPEN;
  return status;
}

/**
 * Only the status changes: the queue lets go of whoever had it, and work with nobody takes
 * `takerId` (whoever moved it, as a pickup would); with no taker, it is a 400.
 */
export function assigneeForStatus(status: TicketStatus, assigneeId: string | null, takerId: string | null): string | null {
  if (status === TicketStatus.OPEN) return null;
  if (isWorkStatus(status) && !assigneeId) {
    if (!takerId) throw new DomainValidationError(NEEDS_ASSIGNEE_MESSAGE);
    return takerId;
  }
  return assigneeId;
}
