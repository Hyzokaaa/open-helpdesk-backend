import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  name: string;
  slug: string;
  description: string;
  accountId?: string | null;
  palette?: string | null;
}

export class Workspace {
  readonly id: Id;
  name: string;
  slug: string;
  description: string;
  accountId: string | null;
  palette: string | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.slug = props.slug;
    this.description = props.description;
    this.accountId = props.accountId ?? null;
    this.palette = props.palette ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
