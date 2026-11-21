import { Readable } from 'node:stream';
import { AttachmentRepository } from '../../../attachment/domain/repositories/attachment.repository';
import { StorageService } from '../../../shared/domain/storage-service';
import { MatrixFileSource, MatrixNoticeFile } from '../../domain/matrix-notice-files';

/** The files of tickets and replies, from the attachments and their storage. */
export class AttachmentMatrixFileSource implements MatrixFileSource {
  private readonly keys = new Map<string, string>();

  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    private readonly storage: StorageService,
  ) {}

  async list(ticketId: string, commentId: string | null): Promise<MatrixNoticeFile[]> {
    const attachments = commentId
      ? await this.attachmentRepository.findByCommentId(commentId)
      : (await this.attachmentRepository.findByTicketId(ticketId)).filter((a) => a.commentId === null);
    return attachments
      .filter((a) => a.ticketId === ticketId)
      .map((a) => {
        this.keys.set(a.getId(), a.s3Key);
        return { id: a.getId(), name: a.originalName || a.fileName, mimeType: a.mimeType, size: a.size };
      });
  }

  async read(file: MatrixNoticeFile): Promise<Buffer> {
    const key = this.keys.get(file.id);
    if (!key) throw new Error(`Unknown file ${file.id}`);
    return toBuffer(await this.storage.getStream(key));
  }
}

async function toBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
