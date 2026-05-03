import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  workspaceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
}

export class AuditLogEntry {
  readonly id: Id;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  workspaceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.action = props.action;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.userId = props.userId;
    this.workspaceId = props.workspaceId;
    this.metadata = props.metadata;
    this.createdAt = props.createdAt;
  }

  getId(): string {
    return this.id.get();
  }
}
