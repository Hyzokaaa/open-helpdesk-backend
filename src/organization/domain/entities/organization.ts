import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  domains: string[];
  workspaceId: string;
}

export class Organization {
  readonly id: Id;
  name: string;
  description: string | null;
  logo: string | null;
  domains: string[];
  workspaceId: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.description = props.description;
    this.logo = props.logo;
    this.domains = props.domains;
    this.workspaceId = props.workspaceId;
  }

  getId(): string {
    return this.id.get();
  }
}
