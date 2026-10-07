import { UpdateWorkspaceSlaPolicy } from '../../../../src/workspace/domain/services/workspace-update-sla-policy';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { DomainValidationError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';

describe('UpdateWorkspaceSlaPolicy', () => {
  let repository: MockWorkspaceRepository;
  let service: UpdateWorkspaceSlaPolicy;

  beforeEach(() => {
    repository = new MockWorkspaceRepository();
    repository.seed(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    service = new UpdateWorkspaceSlaPolicy(repository);
  });

  it('stores only the known priorities of each set of targets', async () => {
    const workspace = await service.execute({
      workspaceId: 'ws-1',
      slaPolicy: {
        firstResponse: { critical: 30, high: null, extra: 'x' },
        resolution: { low: 2880 },
        injected: true,
      } as any,
    });

    expect(workspace.slaPolicy).toEqual({
      firstResponse: { critical: 30, high: null, medium: null, low: null },
      resolution: { critical: null, high: null, medium: null, low: 2880 },
    });
  });

  it('rejects a policy without its targets as a validation error, not a crash', async () => {
    await expect(service.execute({ workspaceId: 'ws-1', slaPolicy: { urgent: 30 } as any }))
      .rejects.toThrow(DomainValidationError);
  });

  it('rejects a target that is not a positive number', async () => {
    await expect(service.execute({
      workspaceId: 'ws-1',
      slaPolicy: { firstResponse: { critical: -5 }, resolution: {} } as any,
    })).rejects.toThrow(DomainValidationError);
  });

  it('clears the policy with null', async () => {
    const workspace = await service.execute({ workspaceId: 'ws-1', slaPolicy: null });
    expect(workspace.slaPolicy).toBeNull();
  });
});
