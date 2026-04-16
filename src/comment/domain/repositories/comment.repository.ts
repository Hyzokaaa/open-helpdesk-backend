import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { Comment } from '../entities/comment';

export interface CommentRepository {
  create(comment: Comment): Promise<void>;
  findById(id: string): Promise<Comment | null>;
  findByTicketId(
    ticketId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Comment>>;
}
