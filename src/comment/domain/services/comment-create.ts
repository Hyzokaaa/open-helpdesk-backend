import { IdGenerator } from '../../../shared/domain/id-generator';
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
      content: props.content,
      ticketId: props.ticketId,
      authorId: props.authorId,
    });

    await this.repository.create(comment);
    return comment;
  }
}
