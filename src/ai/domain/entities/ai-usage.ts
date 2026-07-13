import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  workspaceId: string;
  month: string;
  count: number;
}

export class AiUsage {
  readonly id: Id;
  workspaceId: string;
  month: string;
  count: number;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.month = props.month;
    this.count = props.count;
  }

  getId(): string {
    return this.id.get();
  }
}
