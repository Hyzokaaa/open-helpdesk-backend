import { Attachment } from '../../src/attachment/domain/entities/attachment';
import { AttachmentRepository } from '../../src/attachment/domain/repositories/attachment.repository';

export class MockAttachmentRepository implements AttachmentRepository {
  private attachments: Attachment[] = [];

  async create(attachment: Attachment): Promise<void> {
    this.attachments.push(attachment);
  }

  async findById(id: string): Promise<Attachment | null> {
    return this.attachments.find((a) => a.getId() === id) ?? null;
  }

  async findByTicketId(ticketId: string): Promise<Attachment[]> {
    return this.attachments.filter((a) => a.ticketId === ticketId);
  }

  async findByCommentId(commentId: string): Promise<Attachment[]> {
    return this.attachments.filter((a) => a.commentId === commentId);
  }

  async delete(id: string): Promise<void> {
    this.attachments = this.attachments.filter((a) => a.getId() !== id);
  }

  async findByTokens(tokens: string[]): Promise<Attachment[]> {
    return this.attachments.filter((a) => tokens.includes((a as any).stagingToken));
  }

  async claimStagedAttachments(tokens: string[], ticketId: string): Promise<void> {
    for (const a of this.attachments) {
      if (tokens.includes((a as any).stagingToken)) {
        (a as any).ticketId = ticketId;
        (a as any).stagingToken = null;
      }
    }
  }

  async findExpiredStaged(before: Date): Promise<Attachment[]> {
    return this.attachments.filter((a) => (a as any).stagingToken && (a as any).createdAt < before);
  }

  async deleteMany(ids: string[]): Promise<void> {
    this.attachments = this.attachments.filter((a) => !ids.includes(a.getId()));
  }

  seed(attachment: Attachment): void {
    this.attachments.push(attachment);
  }

  getAll(): Attachment[] {
    return this.attachments;
  }
}
