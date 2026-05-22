import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  address: string;
  workspaceId: string;
  isActive: boolean;
}

export class Mailbox {
  readonly id: Id;
  address: string;
  workspaceId: string;
  isActive: boolean;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.address = props.address;
    this.workspaceId = props.workspaceId;
    this.isActive = props.isActive;
  }

  getId(): string {
    return this.id.get();
  }
}
