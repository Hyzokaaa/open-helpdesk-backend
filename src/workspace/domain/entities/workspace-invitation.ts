import { Id } from '../../../shared/domain/id';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { InvitationStatus } from '../enums/invitation-status.enum';

interface Props {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  invitedById: string;
  createdAt?: Date;
}

export class WorkspaceInvitation {
  readonly id: Id;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  invitedById: string;
  createdAt: Date;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.email = props.email;
    this.role = props.role;
    this.token = props.token;
    this.status = props.status;
    this.expiresAt = props.expiresAt;
    this.invitedById = props.invitedById;
    this.createdAt = props.createdAt ?? new Date();
  }

  getId(): string {
    return this.id.get();
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  accept(): void {
    this.status = InvitationStatus.ACCEPTED;
  }

  reject(): void {
    this.status = InvitationStatus.REJECTED;
  }

  cancel(): void {
    this.status = InvitationStatus.CANCELLED;
  }
}
