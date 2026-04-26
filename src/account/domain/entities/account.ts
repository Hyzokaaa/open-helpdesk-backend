import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  ownerId: string;
  name: string;
}

export class Account {
  readonly id: Id;
  ownerId: string;
  name: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.ownerId = props.ownerId;
    this.name = props.name;
  }

  getId(): string {
    return this.id.get();
  }
}
