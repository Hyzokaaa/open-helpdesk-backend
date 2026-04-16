import { Command } from '../../../shared/domain/command';
import { TicketCategory } from '../../domain/enums/ticket-category.enum';
import { TicketPriority } from '../../domain/enums/ticket-priority.enum';
import { UpdateTicket } from '../../domain/services/ticket-update';

interface Props {
  ticketId: string;
  name?: string;
  description?: string;
  priority?: TicketPriority;
  category?: TicketCategory;
  tagIds?: string[];
}

export interface UpdateTicketResponse {
  id: string;
  name: string;
  priority: string;
  category: string;
}

export class UpdateTicketCommand implements Command<Props, UpdateTicketResponse> {
  constructor(private readonly updateTicket: UpdateTicket) {}

  async execute(props: Props): Promise<UpdateTicketResponse> {
    const ticket = await this.updateTicket.execute(props);

    return {
      id: ticket.getId(),
      name: ticket.name,
      priority: ticket.priority,
      category: ticket.category,
    };
  }
}
