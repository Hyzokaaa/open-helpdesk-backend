import { Command } from '../../../shared/domain/command';
import { TicketCategory } from '../../domain/enums/ticket-category.enum';
import { TicketPriority } from '../../domain/enums/ticket-priority.enum';
import { CreateTicket } from '../../domain/services/ticket-create';

interface Props {
  name: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  workspaceId: string;
  creatorId: string;
  tagIds: string[];
}

export interface CreateTicketResponse {
  id: string;
  name: string;
  status: string;
}

export class CreateTicketCommand implements Command<Props, CreateTicketResponse> {
  constructor(private readonly createTicket: CreateTicket) {}

  async execute(props: Props): Promise<CreateTicketResponse> {
    const ticket = await this.createTicket.execute({
      name: props.name,
      description: props.description,
      priority: props.priority,
      category: props.category,
      workspaceId: props.workspaceId,
      creatorId: props.creatorId,
      tagIds: props.tagIds,
    });

    return {
      id: ticket.getId(),
      name: ticket.name,
      status: ticket.status,
    };
  }
}
