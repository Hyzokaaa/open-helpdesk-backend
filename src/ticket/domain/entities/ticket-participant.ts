import { Id } from '../../../shared/domain/id';
import { ParticipantRole } from '../enums/participant-role.enum';

interface Props {
  id: string;
  ticketId: string;
  userId: string;
  role: ParticipantRole;
}

export class TicketParticipant {
  readonly id: Id;
  ticketId: string;
  userId: string;
  role: ParticipantRole;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.ticketId = props.ticketId;
    this.userId = props.userId;
    this.role = props.role;
  }

  getId(): string {
    return this.id.get();
  }
}
