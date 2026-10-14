import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  ticketId: string | null;
  commentId: string | null;
  uploadedById: string | null;
  token: string | null;
  stagedAt: Date | null;
  /** When it was uploaded, shown next to the file; unset before it is saved. */
  createdAt?: Date | null;
}

export class Attachment {
  readonly id: Id;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  ticketId: string | null;
  commentId: string | null;
  uploadedById: string | null;
  token: string | null;
  stagedAt: Date | null;
  createdAt: Date | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.fileName = props.fileName;
    this.originalName = props.originalName;
    this.mimeType = props.mimeType;
    this.size = props.size;
    this.s3Key = props.s3Key;
    this.ticketId = props.ticketId;
    this.commentId = props.commentId;
    this.uploadedById = props.uploadedById;
    this.token = props.token;
    this.stagedAt = props.stagedAt;
    this.createdAt = props.createdAt ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
