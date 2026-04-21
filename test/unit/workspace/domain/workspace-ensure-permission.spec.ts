import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { PERMISSIONS } from '../../../../src/workspace/domain/permissions';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';

describe('EnsureWorkspacePermission', () => {
  let service: EnsureWorkspacePermission;
  let repository: MockWorkspaceMemberRepository;

  beforeEach(() => {
    repository = new MockWorkspaceMemberRepository();
    service = new EnsureWorkspacePermission(repository);
  });

  it('should pass for admin with any permission', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', role: WorkspaceRole.ADMIN }));

    const result = await service.execute({
      workspaceId: 'ws-1',
      userId: 'user-1',
      permission: PERMISSIONS.TICKET_DELETE,
    });

    expect(result.role).toBe(WorkspaceRole.ADMIN);
  });

  it('should throw AccessDeniedError when user is not a member', async () => {
    await expect(
      service.execute({ workspaceId: 'ws-1', userId: 'stranger', permission: PERMISSIONS.TICKET_VIEW }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('should throw AccessDeniedError when reporter tries to delete', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'reporter-1', role: WorkspaceRole.REPORTER }));

    await expect(
      service.execute({ workspaceId: 'ws-1', userId: 'reporter-1', permission: PERMISSIONS.TICKET_DELETE }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('should allow reporter to create tickets', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-3', workspaceId: 'ws-1', userId: 'reporter-1', role: WorkspaceRole.REPORTER }));

    const result = await service.execute({
      workspaceId: 'ws-1',
      userId: 'reporter-1',
      permission: PERMISSIONS.TICKET_CREATE,
    });

    expect(result.role).toBe(WorkspaceRole.REPORTER);
  });
});
