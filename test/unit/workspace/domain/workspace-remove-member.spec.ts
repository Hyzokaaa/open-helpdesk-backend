import { RemoveWorkspaceMember } from '../../../../src/workspace/domain/services/workspace-remove-member';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { EntityNotFoundError, DomainValidationError } from '../../../../src/shared/domain/errors';

describe('RemoveWorkspaceMember', () => {
  let service: RemoveWorkspaceMember;
  let repository: MockWorkspaceMemberRepository;

  beforeEach(() => {
    repository = new MockWorkspaceMemberRepository();
    service = new RemoveWorkspaceMember(repository);
  });

  it('should remove a member from the workspace', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', role: WorkspaceRole.ADMIN }));
    repository.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'user-2', role: WorkspaceRole.AGENT }));

    await service.execute({ workspaceId: 'ws-1', userId: 'user-2' });

    const remaining = await repository.findByWorkspaceId('ws-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe('user-1');
  });

  it('should throw EntityNotFoundError when member does not exist', async () => {
    await expect(
      service.execute({ workspaceId: 'ws-1', userId: 'nonexistent' }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('should throw DomainValidationError when removing the last member', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', role: WorkspaceRole.ADMIN }));

    await expect(
      service.execute({ workspaceId: 'ws-1', userId: 'user-1' }),
    ).rejects.toThrow(DomainValidationError);
  });
});
