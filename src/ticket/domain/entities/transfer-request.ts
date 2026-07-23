import { Id } from '../../../shared/domain/id';
import { TransferRequestStatus } from '../enums/transfer-request-status.enum';

interface Props {
  id: string;
  ticketId: string;
  requesterId: string;
  targetUserId: string;
  status: TransferRequestStatus;
  expiresAt: Date;
  resolvedAt: Date | null;
  createdAt: Date | null;
}

export class TransferRequest {
  readonly id: Id;
  ticketId: string;
  requesterId: string;
  targetUserId: string;
  status: TransferRequestStatus;
  expiresAt: Date;
  resolvedAt: Date | null;
  createdAt: Date | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.ticketId = props.ticketId;
    this.requesterId = props.requesterId;
    this.targetUserId = props.targetUserId;
    this.status = props.status;
    this.expiresAt = props.expiresAt;
    this.resolvedAt = props.resolvedAt;
    this.createdAt = props.createdAt;
  }

  getId(): string {
    return this.id.get();
  }
}
