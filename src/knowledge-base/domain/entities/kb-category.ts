import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  position: number;
  workspaceId: string;
}

export class KbCategory {
  readonly id: Id;
  name: string;
  slug: string;
  icon: string | null;
  position: number;
  workspaceId: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.slug = props.slug;
    this.icon = props.icon;
    this.position = props.position;
    this.workspaceId = props.workspaceId;
  }

  getId(): string {
    return this.id.get();
  }
}
