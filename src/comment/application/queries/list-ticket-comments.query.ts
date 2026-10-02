import { Query } from '../../../shared/domain/query';
import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { CommentRepository } from '../../domain/repositories/comment.repository';
import { EnsureTicketAccess } from '../../../ticket/domain/services/ticket-ensure-access';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  page: number;
  limit: number;
}

export interface CommentListItem {
  id: string;
  content: string;
  authorId: string;
  mentionedUserIds: string[];
  createdAt: Date | null;
  editedAt: Date | null;
}

export class ListTicketCommentsQuery
  implements Query<Props, PaginatedResult<CommentListItem>>
{
  constructor(
    private readonly repository: CommentRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
  ) {}

  async execute(props: Props): Promise<PaginatedResult<CommentListItem>> {
    await this.ensureTicketAccess.execute({
      ticketId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      isSystemAdmin: props.isSystemAdmin,
    });

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
        editedAt: comment.editedAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
