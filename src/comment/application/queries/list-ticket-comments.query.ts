import { Query } from '../../../shared/domain/query';
import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { CommentRepository } from '../../domain/repositories/comment.repository';
import { EnsureTicketAccess } from '../../../ticket/domain/services/ticket-ensure-access';
import { SummarizeUsers, UserSummary } from '../../../user/domain/services/user-summarize';

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
  author?: UserSummary | null;
}

export class ListTicketCommentsQuery
  implements Query<Props, PaginatedResult<CommentListItem>>
{
  constructor(
    private readonly repository: CommentRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly summarizeUsers?: SummarizeUsers,
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

    const authors = this.summarizeUsers
      ? await this.summarizeUsers.execute(result.items.map((comment) => comment.authorId))
      : null;

    return {
      items: result.items.map((comment) => ({
        id: comment.getId(),
        content: comment.content,
        authorId: comment.authorId,
        mentionedUserIds: comment.mentionedUserIds,
        createdAt: comment.createdAt,
        editedAt: comment.editedAt,
        ...(authors && { author: authors.get(comment.authorId) ?? null }),
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
