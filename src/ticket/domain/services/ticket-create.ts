import { IdGenerator } from '../../../shared/domain/id-generator';
import { Ticket } from '../entities/ticket';
import { TicketCategory } from '../enums/ticket-category.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';

interface CreateTicketProps {
  name: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  workspaceId: string;
  creatorId: string;
  tagIds: string[];
}

export class CreateTicket {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: TicketRepository,
  ) {}

  async execute(props: CreateTicketProps): Promise<Ticket> {
    const ticket = new Ticket({
      id: this.idGenerator.create(),
      name: props.name,
      description: props.description,
      priority: props.priority,
      status: TicketStatus.PENDING,
      category: props.category,
      workspaceId: props.workspaceId,
      creatorId: props.creatorId,
      assigneeId: null,
      resolvedAt: null,
      createdAt: null,
      deletedAt: null,
      tagIds: props.tagIds,
    });

    await this.repository.create(ticket);
    return ticket;
  }
}
