import { CreateWorkspace } from '../../../../src/workspace/domain/services/workspace-create';
import { DomainValidationError } from '../../../../src/shared/domain/errors';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';

describe('CreateWorkspace', () => {
  let service: CreateWorkspace;
  let repository: MockWorkspaceRepository;

  beforeEach(() => {
    repository = new MockWorkspaceRepository();
    service = new CreateWorkspace(new FakeIdGenerator(), repository);
  });

  it('should create a workspace with a slug based on name', async () => {
    const workspace = await service.execute({ name: 'My Workspace', description: 'desc' });

    expect(workspace.name).toBe('My Workspace');
    expect(workspace.slug).toBe('my-workspace');
    expect(workspace.description).toBe('desc');
  });

  it('should throw when slug is already taken', async () => {
    await service.execute({ name: 'My Workspace', description: '' });

    await expect(
      service.execute({ name: 'My Workspace', description: '' }),
    ).rejects.toThrow(DomainValidationError);
  });

  it('should throw when name produces an empty slug', async () => {
    await expect(
      service.execute({ name: '!!!', description: '' }),
    ).rejects.toThrow(DomainValidationError);
  });
});
