import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  name: string;
  slug: string;
  color: string;
  projectId: string | null;
  workspaceId: string;
}

export class TicketCategory {
  readonly id: Id;
  name: string;
  slug: string;
  color: string;
  projectId: string | null;
  workspaceId: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.slug = props.slug;
    this.color = props.color;
    this.projectId = props.projectId;
    this.workspaceId = props.workspaceId;
  }

  getId(): string {
    return this.id.get();
  }
}
