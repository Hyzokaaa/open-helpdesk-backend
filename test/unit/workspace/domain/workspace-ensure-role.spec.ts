import { EnsureWorkspaceRole } from '../../../../src/workspace/domain/services/workspace-ensure-role';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';

describe('EnsureWorkspaceRole', () => {
  let service: EnsureWorkspaceRole;
  let repository: MockWorkspaceMemberRepository;

  beforeEach(() => {
    repository = new MockWorkspaceMemberRepository();
    service = new EnsureWorkspaceRole(repository);
  });

  it('should pass when user has allowed role', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', role: WorkspaceRole.ADMIN }));

    await expect(
      service.execute({ workspaceId: 'ws-1', userId: 'user-1', allowedRoles: [WorkspaceRole.ADMIN] }),
    ).resolves.toBeUndefined();
  });

  it('should throw AccessDeniedError when user is not a member', async () => {
    await expect(
      service.execute({ workspaceId: 'ws-1', userId: 'stranger', allowedRoles: [WorkspaceRole.ADMIN] }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('should throw AccessDeniedError when user role is not in allowed list', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', role: WorkspaceRole.REPORTER }));

    await expect(
      service.execute({ workspaceId: 'ws-1', userId: 'user-1', allowedRoles: [WorkspaceRole.ADMIN, WorkspaceRole.AGENT] }),
    ).rejects.toThrow(AccessDeniedError);
  });
});
