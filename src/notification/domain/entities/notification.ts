import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  userId: string;
  type: string;
  title: string;
  ticketId: string | null;
  workspaceSlug: string;
  isRead: boolean;
  createdAt?: Date;
}

export class Notification {
  readonly id: Id;
  userId: string;
  type: string;
  title: string;
  ticketId: string | null;
  workspaceSlug: string;
  isRead: boolean;
  createdAt?: Date;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.userId = props.userId;
    this.type = props.type;
    this.title = props.title;
    this.ticketId = props.ticketId;
    this.workspaceSlug = props.workspaceSlug;
    this.isRead = props.isRead;
    this.createdAt = props.createdAt;
  }

  getId(): string {
    return this.id.get();
  }
}
