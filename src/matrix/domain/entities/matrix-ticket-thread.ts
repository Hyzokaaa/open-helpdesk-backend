import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  ticketId: string;
  /** The Matrix room ID (!…). */
  roomId: string;
  /** The notice the ticket's later notices answer in a thread. */
  rootEventId: string;
}

/** Where a ticket's notices are threaded in a room. */
export class MatrixTicketThread {
  readonly id: Id;
  ticketId: string;
  roomId: string;
  rootEventId: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.ticketId = props.ticketId;
    this.roomId = props.roomId;
    this.rootEventId = props.rootEventId;
  }

  getId(): string {
    return this.id.get();
  }
}
