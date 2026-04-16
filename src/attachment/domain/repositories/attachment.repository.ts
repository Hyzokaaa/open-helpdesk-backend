import { Attachment } from '../entities/attachment';

export interface AttachmentRepository {
  create(attachment: Attachment): Promise<void>;
  findById(id: string): Promise<Attachment | null>;
  findByTicketId(ticketId: string): Promise<Attachment[]>;
  findByCommentId(commentId: string): Promise<Attachment[]>;
  delete(id: string): Promise<void>;
}
