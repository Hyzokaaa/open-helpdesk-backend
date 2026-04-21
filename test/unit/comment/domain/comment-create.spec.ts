import { CreateComment } from '../../../../src/comment/domain/services/comment-create';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockCommentRepository } from '../../../mocks/mock-comment.repository';

describe('CreateComment', () => {
  let service: CreateComment;
  let repository: MockCommentRepository;

  beforeEach(() => {
    repository = new MockCommentRepository();
    service = new CreateComment(new FakeIdGenerator(), repository);
  });

  it('should create a comment and persist it', async () => {
    const comment = await service.execute({
      content: 'Hello world',
      ticketId: 'ticket-1',
      authorId: 'user-1',
    });

    expect(comment.content).toBe('Hello world');
    expect(comment.ticketId).toBe('ticket-1');
    expect(repository.getAll()).toHaveLength(1);
  });

  it('should sanitize HTML in content', async () => {
    const comment = await service.execute({
      content: '<script>alert("xss")</script> normal text',
      ticketId: 'ticket-1',
      authorId: 'user-1',
    });

    expect(comment.content).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; normal text');
    expect(comment.content).not.toContain('<script>');
  });

  it('should preserve mention patterns after sanitization', async () => {
    const comment = await service.execute({
      content: 'Hey @[John Doe](user-123) check this',
      ticketId: 'ticket-1',
      authorId: 'user-1',
    });

    expect(comment.content).toContain('@[John Doe](user-123)');
  });
});
