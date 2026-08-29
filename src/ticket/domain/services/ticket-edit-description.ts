import { IdGenerator } from '../../../shared/domain/id-generator';
import { Ticket } from '../entities/ticket';
import { TicketDescriptionEdit } from '../entities/ticket-description-edit';
import { TicketDescriptionEditRepository } from '../repositories/ticket-description-edit.repository';

interface EditTicketDescriptionProps {
  ticket: Ticket;
  editedById: string;
}

export class EditTicketDescription {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: TicketDescriptionEditRepository,
  ) {}

  async execute(props: EditTicketDescriptionProps): Promise<void> {
    const edit = new TicketDescriptionEdit({
      id: this.idGenerator.create(),
      ticketId: props.ticket.getId(),
      content: props.ticket.description,
      editedById: props.editedById,
    });

    props.ticket.descriptionEditedAt = new Date();

    await this.repository.create(edit);
  }
}
