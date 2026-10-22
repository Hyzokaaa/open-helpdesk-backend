import { PaginatedResult } from '../../src/shared/domain/paginated-result';
import { Comment } from '../../src/comment/domain/entities/comment';
import { CommentRepository } from '../../src/comment/domain/repositories/comment.repository';

export class MockCommentRepository implements CommentRepository {
  private comments: Comment[] = [];

  async create(comment: Comment): Promise<void> {
    this.comments.push(comment);
  }

  async findById(id: string): Promise<Comment | null> {
    return this.comments.find((c) => c.getId() === id) ?? null;
  }

  async update(comment: Comment): Promise<void> {
    const index = this.comments.findIndex((c) => c.getId() === comment.getId());
    if (index !== -1) this.comments[index] = comment;
  }

  async findByTicketId(ticketId: string, page: number, limit: number): Promise<PaginatedResult<Comment>> {
    const items = this.comments.filter((c) => c.ticketId === ticketId);
    return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit };
  }

  async hasCommentBy(ticketId: string, authorId: string, from: Date, to: Date): Promise<boolean> {
    return this.comments.some((c) => c.ticketId === ticketId && c.authorId === authorId && !!c.createdAt && c.createdAt >= from && c.createdAt <= to);
  }

  getAll(): Comment[] {
    return this.comments;
  }
}
