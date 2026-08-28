import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
}

export class Project {
  readonly id: Id;
  name: string;
  description: string | null;
  workspaceId: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.description = props.description;
    this.workspaceId = props.workspaceId;
  }

  getId(): string {
    return this.id.get();
  }
}
