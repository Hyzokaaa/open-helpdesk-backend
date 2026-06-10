import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  workspaceId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: Date | null;
}

export class Webhook {
  readonly id: Id;
  workspaceId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: Date | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.url = props.url;
    this.events = props.events;
    this.secret = props.secret;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
  }

  getId(): string {
    return this.id.get();
  }
}
