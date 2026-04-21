import { DeleteTag } from '../../../../src/tag/domain/services/tag-delete';
import { Tag } from '../../../../src/tag/domain/entities/tag';
import { MockTagRepository } from '../../../mocks/mock-tag.repository';
import { EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('DeleteTag', () => {
  let service: DeleteTag;
  let repository: MockTagRepository;

  beforeEach(() => {
    repository = new MockTagRepository();
    service = new DeleteTag(repository);
  });

  it('should delete an existing tag', async () => {
    repository.seed(new Tag({ id: 'tag-1', name: 'bug', color: null, workspaceId: 'ws-1' }));

    await service.execute({ id: 'tag-1' });

    expect(await repository.findById('tag-1')).toBeNull();
  });

  it('should throw EntityNotFoundError when tag does not exist', async () => {
    await expect(service.execute({ id: 'nope' })).rejects.toThrow(EntityNotFoundError);
  });
});
