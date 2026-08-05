import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  workspaceId: string | null;
  metadata: Record<string, unknown> | null;
  category: string;
  level: string;
  source: string | null;
  createdAt?: Date;
}

export class AuditLogEntry {
  readonly id: Id;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  workspaceId: string | null;
  metadata: Record<string, unknown> | null;
  category: string;
  level: string;
  source: string | null;
  createdAt?: Date;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.action = props.action;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.userId = props.userId;
    this.workspaceId = props.workspaceId;
    this.metadata = props.metadata;
    this.category = props.category;
    this.level = props.level;
    this.source = props.source;
    this.createdAt = props.createdAt;
  }

  getId(): string {
    return this.id.get();
  }
}
