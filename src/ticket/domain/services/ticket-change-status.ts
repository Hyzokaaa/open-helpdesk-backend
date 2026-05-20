import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketDiscardReason } from '../enums/ticket-discard-reason.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';

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
}

export class ChangeTicketStatus {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: ChangeTicketStatusProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new EntityNotFoundError('Ticket not found');
    }

    const allowed = props.canMoveToOpen
      ? ALL_STATUSES
      : ALLOWED_TRANSITIONS[ticket.status];
    if (!allowed.includes(props.status)) {
      throw new DomainValidationError(
        `Cannot transition from '${ticket.status}' to '${props.status}'`,
      );
    }

    if (ticket.status === TicketStatus.OPEN && props.status !== TicketStatus.OPEN && !ticket.assigneeId) {
      ticket.assigneeId = props.userId;
    }

    if (props.status === TicketStatus.OPEN) {
      ticket.assigneeId = null;
    }

    ticket.status = props.status;

    if (props.status === TicketStatus.RESOLVED) {
      ticket.resolvedAt = new Date();
      ticket.resolvedById = props.userId;
      ticket.discardReason = null;
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
