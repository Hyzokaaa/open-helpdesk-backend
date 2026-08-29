import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';

const VALID_PICKUP_STATUSES = [TicketStatus.PENDING, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED];

interface PickupTicketProps {
  ticketId: string;
  userId: string;
  status?: TicketStatus;
}

export class PickupTicket {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: PickupTicketProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    if (ticket.status !== TicketStatus.OPEN) {
      throw new DomainValidationError('Only open tickets can be picked up');
    }

    const targetStatus = props.status ?? TicketStatus.PENDING;
    if (!VALID_PICKUP_STATUSES.includes(targetStatus)) {
      throw new DomainValidationError('Invalid pickup status');
    }

    ticket.assigneeId = props.userId;
    ticket.status = targetStatus;

    await this.repository.update(ticket);
    return ticket;
  }
}
