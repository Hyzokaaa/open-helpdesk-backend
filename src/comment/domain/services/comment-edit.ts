import { IdGenerator } from '../../../shared/domain/id-generator';
import { EntityNotFoundError, AccessDeniedError } from '../../../shared/domain/errors';
import { sanitizeHtml } from '../../../shared/domain/sanitize-html';
import { Comment } from '../entities/comment';
import { CommentEdit } from '../entities/comment-edit';
import { CommentRepository } from '../repositories/comment.repository';
import { CommentEditRepository } from '../repositories/comment-edit.repository';

interface EditCommentProps {
  commentId: string;
  content: string;
  userId: string;
  isAdmin: boolean;
}

export class EditComment {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly commentRepository: CommentRepository,
    private readonly commentEditRepository: CommentEditRepository,
  ) {}

  async execute(props: EditCommentProps): Promise<Comment> {
    const comment = await this.commentRepository.findById(props.commentId);
    if (!comment) {
      throw new EntityNotFoundError('Comment not found');
    }

    if (comment.authorId !== props.userId && !props.isAdmin) {
      throw new AccessDeniedError('You can only edit your own comments');
    }

    const sanitizedContent = sanitizeHtml(props.content);

    const edit = new CommentEdit({
      id: this.idGenerator.create(),
      commentId: comment.getId(),
      content: comment.content,
      editedById: props.userId,
    });

    comment.content = sanitizedContent;
    comment.editedAt = new Date();

    await this.commentEditRepository.create(edit);
    await this.commentRepository.update(comment);

    return comment;
  }
}
