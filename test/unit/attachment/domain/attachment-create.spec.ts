import { CreateAttachment } from '../../../../src/attachment/domain/services/attachment-create';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockAttachmentRepository } from '../../../mocks/mock-attachment.repository';
import { FakeS3Storage } from '../../../mocks/fake-s3-storage';

describe('CreateAttachment', () => {
  let service: CreateAttachment;
  let repository: MockAttachmentRepository;
  let storage: FakeS3Storage;

  beforeEach(() => {
    repository = new MockAttachmentRepository();
    storage = new FakeS3Storage();
    service = new CreateAttachment(new FakeIdGenerator(), repository, storage as any);
  });

  it('should upload file to S3 and persist attachment', async () => {
    const buffer = Buffer.from('file content');

    const attachment = await service.execute({
      buffer,
      originalName: 'photo.png',
      mimeType: 'image/png',
      size: 12,
      ticketId: 'ticket-1',
      commentId: null,
    });

    expect(attachment.originalName).toBe('photo.png');
    expect(attachment.mimeType).toBe('image/png');
    expect(attachment.ticketId).toBe('ticket-1');
    expect(attachment.s3Key).toContain('attachments/');
    expect(storage.hasFile(attachment.s3Key)).toBe(true);
    expect(repository.getAll()).toHaveLength(1);
  });
});
