import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  title: string;
  content: string;
  workspaceId: string;
}

export class CannedResponse {
  readonly id: Id;
  title: string;
  content: string;
  workspaceId: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.title = props.title;
    this.content = props.content;
    this.workspaceId = props.workspaceId;
  }

  getId(): string {
    return this.id.get();
  }
}
