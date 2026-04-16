import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  name: string;
  slug: string;
  description: string;
  dealerId: string | null;
}

export class Workspace {
  readonly id: Id;
  name: string;
  slug: string;
  description: string;
  dealerId: string | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.slug = props.slug;
    this.description = props.description;
    this.dealerId = props.dealerId;
  }

  getId(): string {
    return this.id.get();
  }
}
