import { Command } from '../../../shared/domain/command';
import { CreateComment } from '../../domain/services/comment-create';

interface Props {
  content: string;
  ticketId: string;
  authorId: string;
}

export interface CreateCommentResponse {
  id: string;
  content: string;
  ticketId: string;
  authorId: string;
}

export class CreateCommentCommand implements Command<Props, CreateCommentResponse> {
  constructor(private readonly createComment: CreateComment) {}

  async execute(props: Props): Promise<CreateCommentResponse> {
    const comment = await this.createComment.execute({
      content: props.content,
      ticketId: props.ticketId,
      authorId: props.authorId,
    });

    return {
      id: comment.getId(),
      content: comment.content,
      ticketId: comment.ticketId,
      authorId: comment.authorId,
    };
  }
}
