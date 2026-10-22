import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketDiscardReason } from '../enums/ticket-discard-reason.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { isClosedStatus, markResolved } from '../ticket-resolution';
import { assigneeForStatus } from '../ticket-assignment-rule';

/** Said when a closed ticket is moved back to work: that is reopening, with its own reason. */
export const USE_REOPEN_MESSAGE = 'A resolved or discarded ticket is reopened with POST /tickets/:id/reopen, giving a reason';

const ALL_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.PENDING,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
  TicketStatus.DISCARDED,
];

const ALL_EXCEPT_OPEN = ALL_STATUSES.filter((s) => s !== TicketStatus.OPEN);

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.OPEN]: ALL_STATUSES,
  [TicketStatus.PENDING]: ALL_EXCEPT_OPEN,
  [TicketStatus.IN_PROGRESS]: ALL_EXCEPT_OPEN,
  [TicketStatus.RESOLVED]: ALL_EXCEPT_OPEN,
  [TicketStatus.DISCARDED]: ALL_EXCEPT_OPEN,
};

interface ChangeTicketStatusProps {
  ticketId: string;
  status: TicketStatus;
  discardReason?: TicketDiscardReason;
  userId: string;
  canMoveToOpen?: boolean;
  /** Who takes it when it goes to work with nobody assigned (whoever moved it); null refuses it. */
  takerId?: string | null;
}

export class ChangeTicketStatus {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: ChangeTicketStatusProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new EntityNotFoundError('Ticket not found');
    }

    // Reopening has its own action, with a reason; changing the status never does it
    if (isClosedStatus(ticket.status) && !isClosedStatus(props.status)) {
      throw new DomainValidationError(USE_REOPEN_MESSAGE);
    }

    const allowed = props.canMoveToOpen
      ? ALL_STATUSES
      : ALLOWED_TRANSITIONS[ticket.status];
    if (!allowed.includes(props.status)) {
      throw new DomainValidationError(
        `Cannot transition from '${ticket.status}' to '${props.status}'`,
      );
    }

    // The queue lets go of whoever had it; work with nobody takes whoever moved it
    ticket.assigneeId = assigneeForStatus(props.status, ticket.assigneeId, props.takerId ?? null);

    ticket.status = props.status;

    if (props.status === TicketStatus.RESOLVED) {
      markResolved(ticket, props.userId);
    } else if (props.status === TicketStatus.DISCARDED) {
      if (!props.discardReason) {
        throw new DomainValidationError('Discard reason is required');
      }
      ticket.discardReason = props.discardReason;
    } else {
      ticket.resolvedAt = null;
      ticket.resolvedById = null;
      ticket.discardReason = null;
    }

    await this.repository.update(ticket);
    return ticket;
  }
}
