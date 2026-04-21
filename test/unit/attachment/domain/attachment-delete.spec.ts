import { DeleteAttachment } from '../../../../src/attachment/domain/services/attachment-delete';
import { Attachment } from '../../../../src/attachment/domain/entities/attachment';
import { MockAttachmentRepository } from '../../../mocks/mock-attachment.repository';
import { FakeS3Storage } from '../../../mocks/fake-s3-storage';
import { EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('DeleteAttachment', () => {
  let service: DeleteAttachment;
  let repository: MockAttachmentRepository;
  let storage: FakeS3Storage;

  beforeEach(() => {
    repository = new MockAttachmentRepository();
    storage = new FakeS3Storage();
    service = new DeleteAttachment(repository, storage as any);
  });

  it('should delete from S3 and repository', async () => {
    storage.upload(Buffer.from('x'), 'attachments/att-1/file.png', 'image/png');
    repository.seed(new Attachment({
      id: 'att-1', fileName: 'file.png', originalName: 'file.png',
      mimeType: 'image/png', size: 1, s3Key: 'attachments/att-1/file.png',
      ticketId: 'ticket-1', commentId: null,
    }));

    await service.execute({ attachmentId: 'att-1' });

    expect(await repository.findById('att-1')).toBeNull();
    expect(storage.hasFile('attachments/att-1/file.png')).toBe(false);
  });

  it('should throw EntityNotFoundError when attachment does not exist', async () => {
    await expect(service.execute({ attachmentId: 'nope' })).rejects.toThrow(EntityNotFoundError);
  });
});
