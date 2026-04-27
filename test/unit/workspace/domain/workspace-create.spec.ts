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

  it('should create a workspace with a slug based on name plus random suffix', async () => {
    const workspace = await service.execute({ name: 'My Workspace', description: 'desc' });

    expect(workspace.name).toBe('My Workspace');
    expect(workspace.slug).toMatch(/^my-workspace-[a-z0-9]{4}$/);
    expect(workspace.description).toBe('desc');
  });

  it('should generate unique slug when duplicate exists', async () => {
    const first = await service.execute({ name: 'My Workspace', description: '' });
    const second = await service.execute({ name: 'My Workspace', description: '' });

    expect(first.slug).toMatch(/^my-workspace-[a-z0-9]{4}$/);
    expect(second.slug).toMatch(/^my-workspace-[a-z0-9]{4}$/);
    expect(first.slug).not.toBe(second.slug);
  });
});
