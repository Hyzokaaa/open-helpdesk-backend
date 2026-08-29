import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { EditTicketDescription } from './ticket-edit-description';

interface UpdateTicketProps {
  ticketId: string;
  name?: string;
  description?: string;
  priority?: TicketPriority;
  categoryId?: string;
  tagIds?: string[];
  departmentId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  customFields?: Record<string, unknown>;
  editedById?: string;
}

export class UpdateTicket {
  constructor(
    private readonly repository: TicketRepository,
    private readonly editDescription?: EditTicketDescription,
  ) {}

  async execute(props: UpdateTicketProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new EntityNotFoundError('Ticket not found');
    }

    if (props.name !== undefined) ticket.name = props.name;
    if (props.description !== undefined && props.description !== ticket.description) {
      if (this.editDescription && props.editedById) {
        await this.editDescription.execute({ ticket, editedById: props.editedById });
      }
      ticket.description = props.description;
    }
    if (props.priority !== undefined) ticket.priority = props.priority;
    if (props.categoryId !== undefined) ticket.categoryId = props.categoryId;
    if (props.tagIds !== undefined) ticket.tagIds = props.tagIds;
    if (props.departmentId !== undefined) ticket.departmentId = props.departmentId;
    if (props.organizationId !== undefined) ticket.organizationId = props.organizationId;
    if (props.projectId !== undefined) ticket.projectId = props.projectId;
    if (props.customFields !== undefined) ticket.customFields = { ...ticket.customFields, ...props.customFields };

    await this.repository.update(ticket);
    return ticket;
  }
}
