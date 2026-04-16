import { NotFoundException } from '@nestjs/common';
import { TicketRepository } from '../repositories/ticket.repository';

interface DeleteTicketProps {
  ticketId: string;
}

export class DeleteTicket {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: DeleteTicketProps): Promise<void> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    await this.repository.softDelete(props.ticketId);
  }
}
