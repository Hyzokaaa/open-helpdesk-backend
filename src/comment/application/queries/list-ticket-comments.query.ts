import { Query } from '../../../shared/domain/query';
import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { CommentRepository } from '../../domain/repositories/comment.repository';

interface Props {
  ticketId: string;
  page: number;
  limit: number;
}

export interface CommentListItem {
  id: string;
  content: string;
  authorId: string;
  mentionedUserIds: string[];
  createdAt: Date | null;
}

export class ListTicketCommentsQuery
  implements Query<Props, PaginatedResult<CommentListItem>>
{
  constructor(private readonly repository: CommentRepository) {}

  async execute(props: Props): Promise<PaginatedResult<CommentListItem>> {
    const result = await this.repository.findByTicketId(
      props.ticketId,
      props.page,
      props.limit,
    );

    return {
      items: result.items.map((comment) => ({
        id: comment.getId(),
        content: comment.content,
        authorId: comment.authorId,
        mentionedUserIds: comment.mentionedUserIds,
        createdAt: comment.createdAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
