import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketCategory } from '../enums/ticket-category.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketRepository } from '../repositories/ticket.repository';

interface UpdateTicketProps {
  ticketId: string;
  name?: string;
  description?: string;
  priority?: TicketPriority;
  category?: TicketCategory;
  tagIds?: string[];
}

export class UpdateTicket {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: UpdateTicketProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new EntityNotFoundError('Ticket not found');
    }

    if (props.name !== undefined) ticket.name = props.name;
    if (props.description !== undefined) ticket.description = props.description;
    if (props.priority !== undefined) ticket.priority = props.priority;
    if (props.category !== undefined) ticket.category = props.category;
    if (props.tagIds !== undefined) ticket.tagIds = props.tagIds;

    await this.repository.update(ticket);
    return ticket;
  }
}
