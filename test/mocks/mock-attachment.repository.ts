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
    return this.attachments.filter((a) => a.token !== null && tokens.includes(a.token));
  }

  async claimStagedAttachments(tokens: string[], ticketId: string, uploadedById: string): Promise<void> {
    for (const a of this.attachments) {
      if (a.token !== null && tokens.includes(a.token) && a.uploadedById === uploadedById) {
        a.ticketId = ticketId;
        a.token = null;
        a.stagedAt = null;
      }
    }
  }

  async findExpiredStaged(before: Date): Promise<Attachment[]> {
    return this.attachments.filter((a) => a.stagedAt !== null && a.stagedAt < before);
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
