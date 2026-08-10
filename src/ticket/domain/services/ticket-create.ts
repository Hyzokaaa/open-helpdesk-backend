import { IdGenerator } from '../../../shared/domain/id-generator';
import { Ticket } from '../entities/ticket';
import { TicketCategory } from '../enums/ticket-category.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketSource } from '../enums/ticket-source.enum';
import { TicketRepository } from '../repositories/ticket.repository';

interface CreateTicketProps {
  name: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  workspaceId: string;
  reporterId: string;
  tagIds: string[];
  customFields?: Record<string, unknown>;
  departmentId?: string | null;
  source?: TicketSource;
  registeredById?: string | null;
  portalToken?: string | null;
  mailboxId?: string | null;
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
      status: TicketStatus.OPEN,
      category: props.category,
      workspaceId: props.workspaceId,
      reporterId: props.reporterId,
      assigneeId: null,
      firstResponseAt: null,
      resolvedAt: null,
      resolvedById: null,
      createdAt: null,
      deletedAt: null,
      tagIds: props.tagIds,
      customFields: props.customFields ?? {},
      discardReason: null,
      departmentId: props.departmentId ?? null,
      source: props.source,
      registeredById: props.registeredById ?? null,
      portalToken: props.portalToken ?? null,
      mailboxId: props.mailboxId ?? null,
    });

    await this.repository.create(ticket);
    return ticket;
  }
}
