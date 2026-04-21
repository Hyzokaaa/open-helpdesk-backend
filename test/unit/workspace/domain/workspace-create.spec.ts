import { CreateWorkspace } from '../../../../src/workspace/domain/services/workspace-create';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';

describe('CreateWorkspace', () => {
  let service: CreateWorkspace;
  let repository: MockWorkspaceRepository;

  beforeEach(() => {
    repository = new MockWorkspaceRepository();
    service = new CreateWorkspace(new FakeIdGenerator(), repository);
  });

  it('should create a workspace with a slug', async () => {
    const workspace = await service.execute({ name: 'My Workspace', description: 'desc' });

    expect(workspace.name).toBe('My Workspace');
    expect(workspace.slug).toBe('my-workspace');
    expect(workspace.description).toBe('desc');
  });

  it('should generate unique slug when duplicate exists', async () => {
    repository.seed(new Workspace({ id: 'existing', name: 'X', slug: 'my-workspace', description: '' }));

    const workspace = await service.execute({ name: 'My Workspace', description: '' });

    expect(workspace.slug).toBe('my-workspace-2');
  });
});
