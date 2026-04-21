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

  seed(attachment: Attachment): void {
    this.attachments.push(attachment);
  }

  getAll(): Attachment[] {
    return this.attachments;
  }
}
