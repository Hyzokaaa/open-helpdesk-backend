import { IdGenerator } from '../../../shared/domain/id-generator';
import { sanitizeHtml } from '../../../shared/domain/sanitize-html';
import { Comment } from '../entities/comment';
import { CommentRepository } from '../repositories/comment.repository';

interface CreateCommentProps {
  content: string;
  ticketId: string;
  authorId: string;
}

export class CreateComment {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: CommentRepository,
  ) {}

  async execute(props: CreateCommentProps): Promise<Comment> {
    const comment = new Comment({
      id: this.idGenerator.create(),
      content: sanitizeHtml(props.content),
      ticketId: props.ticketId,
      authorId: props.authorId,
    });

    await this.repository.create(comment);
    return comment;
  }
}
