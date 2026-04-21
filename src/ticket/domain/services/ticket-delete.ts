import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketRepository } from '../repositories/ticket.repository';

interface DeleteTicketProps {
  ticketId: string;
}

export class DeleteTicket {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: DeleteTicketProps): Promise<void> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new EntityNotFoundError('Ticket not found');
    }

    await this.repository.softDelete(props.ticketId);
  }
}
