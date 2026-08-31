import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  commentId: string;
  content: string;
  editedById: string;
  createdAt?: Date | null;
}

export class CommentEdit {
  readonly id: Id;
  commentId: string;
  content: string;
  editedById: string;
  createdAt: Date | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.commentId = props.commentId;
    this.content = props.content;
    this.editedById = props.editedById;
    this.createdAt = props.createdAt ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
