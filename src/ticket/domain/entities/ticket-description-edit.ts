import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  ticketId: string;
  content: string;
  editedById: string;
  createdAt?: Date | null;
}

export class TicketDescriptionEdit {
  readonly id: Id;
  ticketId: string;
  content: string;
  editedById: string;
  createdAt: Date | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.ticketId = props.ticketId;
    this.content = props.content;
    this.editedById = props.editedById;
    this.createdAt = props.createdAt ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
