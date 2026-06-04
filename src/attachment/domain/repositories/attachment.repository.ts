import { Attachment } from '../entities/attachment';

export interface AttachmentRepository {
  create(attachment: Attachment): Promise<void>;
  findById(id: string): Promise<Attachment | null>;
  findByTicketId(ticketId: string): Promise<Attachment[]>;
  findByCommentId(commentId: string): Promise<Attachment[]>;
  delete(id: string): Promise<void>;
  findByTokens(tokens: string[]): Promise<Attachment[]>;
  claimStagedAttachments(tokens: string[], ticketId: string): Promise<void>;
  findExpiredStaged(before: Date): Promise<Attachment[]>;
  deleteMany(ids: string[]): Promise<void>;
}
