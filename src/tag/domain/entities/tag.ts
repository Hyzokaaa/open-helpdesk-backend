import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  name: string;
  color: string | null;
  workspaceId: string;
}

export class Tag {
  readonly id: Id;
  name: string;
  color: string | null;
  workspaceId: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.color = props.color;
    this.workspaceId = props.workspaceId;
  }

  getId(): string {
    return this.id.get();
  }
}
