import { NotFoundException } from '@nestjs/common';
import { Ticket } from '../entities/ticket';
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
      throw new NotFoundException('Ticket not found');
    }

    ticket.assigneeId = props.assigneeId;

    await this.repository.update(ticket);
    return ticket;
  }
}
