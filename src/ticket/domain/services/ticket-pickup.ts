import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';

interface PickupTicketProps {
  ticketId: string;
  userId: string;
}

export class PickupTicket {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: PickupTicketProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    if (ticket.status !== TicketStatus.OPEN) {
      throw new DomainValidationError('Only open tickets can be picked up');
    }

    ticket.assigneeId = props.userId;
    ticket.status = TicketStatus.PENDING;

    await this.repository.update(ticket);
    return ticket;
  }
}
