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

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.fileName = props.fileName;
    this.originalName = props.originalName;
    this.mimeType = props.mimeType;
    this.size = props.size;
    this.s3Key = props.s3Key;
    this.ticketId = props.ticketId;
    this.commentId = props.commentId;
  }

  getId(): string {
    return this.id.get();
  }
}
