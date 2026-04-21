import { UpdateWorkspace } from '../../../../src/workspace/domain/services/workspace-update';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { AccessDeniedError, EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('UpdateWorkspace', () => {
  let service: UpdateWorkspace;
  let repository: MockWorkspaceRepository;

  beforeEach(() => {
    repository = new MockWorkspaceRepository();
    service = new UpdateWorkspace(repository);
    repository.seed(new Workspace({ id: 'ws-1', name: 'Original', slug: 'original', description: 'desc' }));
  });

  it('should update name and description when system admin', async () => {
    const result = await service.execute({
      workspaceId: 'ws-1',
      name: 'Updated',
      description: 'new desc',
      isSystemAdmin: true,
    });

    expect(result.name).toBe('Updated');
    expect(result.description).toBe('new desc');
    expect(result.slug).toBe('original');
  });

  it('should throw AccessDeniedError when not system admin', async () => {
    await expect(
      service.execute({ workspaceId: 'ws-1', name: 'X', isSystemAdmin: false }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('should throw EntityNotFoundError when workspace does not exist', async () => {
    await expect(
      service.execute({ workspaceId: 'nope', name: 'X', isSystemAdmin: true }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
