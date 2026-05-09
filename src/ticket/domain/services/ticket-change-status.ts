import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketDiscardReason } from '../enums/ticket-discard-reason.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';

const ALL_STATUSES = [
  TicketStatus.PENDING,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
  TicketStatus.DISCARDED,
];

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.PENDING]: ALL_STATUSES,
  [TicketStatus.IN_PROGRESS]: ALL_STATUSES,
  [TicketStatus.RESOLVED]: ALL_STATUSES,
  [TicketStatus.DISCARDED]: ALL_STATUSES,
};

interface ChangeTicketStatusProps {
  ticketId: string;
  status: TicketStatus;
  discardReason?: TicketDiscardReason;
  userId: string;
}

export class ChangeTicketStatus {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: ChangeTicketStatusProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new EntityNotFoundError('Ticket not found');
    }

    const allowed = ALLOWED_TRANSITIONS[ticket.status];
    if (!allowed.includes(props.status)) {
      throw new DomainValidationError(
        `Cannot transition from '${ticket.status}' to '${props.status}'`,
      );
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
