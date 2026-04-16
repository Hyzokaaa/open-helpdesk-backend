import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  content: string;
  ticketId: string;
  authorId: string;
}

export class Comment {
  readonly id: Id;
  content: string;
  ticketId: string;
  authorId: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.content = props.content;
    this.ticketId = props.ticketId;
    this.authorId = props.authorId;
  }

  getId(): string {
    return this.id.get();
  }
}
