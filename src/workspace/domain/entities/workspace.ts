import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export class Workspace {
  readonly id: Id;
  name: string;
  slug: string;
  description: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.slug = props.slug;
    this.description = props.description;
  }

  getId(): string {
    return this.id.get();
  }
}
