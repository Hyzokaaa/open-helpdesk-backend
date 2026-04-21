import { CreateTag } from '../../../../src/tag/domain/services/tag-create';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockTagRepository } from '../../../mocks/mock-tag.repository';

describe('CreateTag', () => {
  let service: CreateTag;
  let repository: MockTagRepository;

  beforeEach(() => {
    repository = new MockTagRepository();
    service = new CreateTag(new FakeIdGenerator(), repository);
  });

  it('should create a tag with color', async () => {
    const tag = await service.execute({ name: 'urgent', color: '#ff0000', workspaceId: 'ws-1' });

    expect(tag.name).toBe('urgent');
    expect(tag.color).toBe('#ff0000');
    expect(tag.workspaceId).toBe('ws-1');
  });

  it('should create a tag without color', async () => {
    const tag = await service.execute({ name: 'misc', color: null, workspaceId: 'ws-1' });

    expect(tag.color).toBeNull();
  });
});
