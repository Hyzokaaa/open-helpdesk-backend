import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketRepository } from '../repositories/ticket.repository';
import { statusForAssignee } from '../ticket-assignment-rule';

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
    // Assigned from the queue it becomes Pending; left with nobody, work goes back to the queue
    ticket.status = statusForAssignee(ticket.status, props.assigneeId);

    await this.repository.update(ticket);
    return ticket;
  }
}
