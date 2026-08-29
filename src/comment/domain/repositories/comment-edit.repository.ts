import { CommentEdit } from '../entities/comment-edit';

export interface CommentEditRepository {
  create(edit: CommentEdit): Promise<void>;
  findByCommentId(commentId: string): Promise<CommentEdit[]>;
}
