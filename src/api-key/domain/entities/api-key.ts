import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date | null;
  createdById: string;
}

export class ApiKey {
  readonly id: Id;
  workspaceId: string;
  name: string;
  key: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date | null;
  createdById: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.name = props.name;
    this.key = props.key;
    this.prefix = props.prefix;
    this.scopes = props.scopes;
    this.expiresAt = props.expiresAt;
    this.lastUsedAt = props.lastUsedAt;
    this.createdAt = props.createdAt;
    this.createdById = props.createdById;
  }

  getId(): string {
    return this.id.get();
  }
}
