import { DeleteWorkspace } from '../../../../src/workspace/domain/services/workspace-delete';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { AccessDeniedError, EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('DeleteWorkspace', () => {
  let service: DeleteWorkspace;
  let repository: MockWorkspaceRepository;

  beforeEach(() => {
    repository = new MockWorkspaceRepository();
    service = new DeleteWorkspace(repository);
    repository.seed(new Workspace({ id: 'ws-1', name: 'Test', slug: 'test', description: '' }));
  });

  it('should delete workspace when system admin', async () => {
    await service.execute({ workspaceId: 'ws-1', isSystemAdmin: true });
    expect(await repository.findById('ws-1')).toBeNull();
  });

  it('should throw AccessDeniedError when not system admin', async () => {
    await expect(
      service.execute({ workspaceId: 'ws-1', isSystemAdmin: false }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('should throw EntityNotFoundError when workspace does not exist', async () => {
    await expect(
      service.execute({ workspaceId: 'nope', isSystemAdmin: true }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
