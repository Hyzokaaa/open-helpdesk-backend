import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';

interface AssignTicketProps {
  ticketId: string;
  assigneeId: string | null;
}

export class AssignTicket {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: AssignTicketProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new EntityNotFoundError('Ticket not found');
    }

    ticket.assigneeId = props.assigneeId;

    if (props.assigneeId && ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.PENDING;
    }

    await this.repository.update(ticket);
    return ticket;
  }
}
