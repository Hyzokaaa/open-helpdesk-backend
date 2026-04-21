import { ChangeWorkspaceMemberRole } from '../../../../src/workspace/domain/services/workspace-change-member-role';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('ChangeWorkspaceMemberRole', () => {
  let service: ChangeWorkspaceMemberRole;
  let repository: MockWorkspaceMemberRepository;

  beforeEach(() => {
    repository = new MockWorkspaceMemberRepository();
    service = new ChangeWorkspaceMemberRole(repository);
  });

  it('should allow workspace admin to change non-admin role', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'admin-1', role: WorkspaceRole.ADMIN }));
    repository.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'agent-1', role: WorkspaceRole.AGENT }));

    const result = await service.execute({
      workspaceId: 'ws-1',
      targetUserId: 'agent-1',
      newRole: WorkspaceRole.REPORTER,
      requestingUserId: 'admin-1',
      isSystemAdmin: false,
    });

    expect(result.role).toBe(WorkspaceRole.REPORTER);
  });

  it('should allow system admin to change any role including admin', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'admin-1', role: WorkspaceRole.ADMIN }));
    repository.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'admin-2', role: WorkspaceRole.ADMIN }));

    const result = await service.execute({
      workspaceId: 'ws-1',
      targetUserId: 'admin-1',
      newRole: WorkspaceRole.AGENT,
      requestingUserId: 'sys-admin',
      isSystemAdmin: true,
    });

    expect(result.role).toBe(WorkspaceRole.AGENT);
  });

  it('should throw AccessDeniedError when workspace admin tries to change another admin role', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'admin-1', role: WorkspaceRole.ADMIN }));
    repository.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'admin-2', role: WorkspaceRole.ADMIN }));

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        targetUserId: 'admin-2',
        newRole: WorkspaceRole.AGENT,
        requestingUserId: 'admin-1',
        isSystemAdmin: false,
      }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('should throw AccessDeniedError when non-admin tries to change role', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'agent-1', role: WorkspaceRole.AGENT }));
    repository.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'reporter-1', role: WorkspaceRole.REPORTER }));

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        targetUserId: 'reporter-1',
        newRole: WorkspaceRole.AGENT,
        requestingUserId: 'agent-1',
        isSystemAdmin: false,
      }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('should throw AccessDeniedError when workspace admin tries to promote to admin', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'admin-1', role: WorkspaceRole.ADMIN }));
    repository.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'agent-1', role: WorkspaceRole.AGENT }));

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        targetUserId: 'agent-1',
        newRole: WorkspaceRole.ADMIN,
        requestingUserId: 'admin-1',
        isSystemAdmin: false,
      }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('should allow system admin to promote to admin', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'agent-1', role: WorkspaceRole.AGENT }));

    const result = await service.execute({
      workspaceId: 'ws-1',
      targetUserId: 'agent-1',
      newRole: WorkspaceRole.ADMIN,
      requestingUserId: 'sys-admin',
      isSystemAdmin: true,
    });

    expect(result.role).toBe(WorkspaceRole.ADMIN);
  });

  it('should throw DomainValidationError when demoting the last admin', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'admin-1', role: WorkspaceRole.ADMIN }));

    await expect(
      service.execute({
        workspaceId: 'ws-1',
        targetUserId: 'admin-1',
        newRole: WorkspaceRole.AGENT,
        requestingUserId: 'sys-admin',
        isSystemAdmin: true,
      }),
    ).rejects.toThrow(DomainValidationError);
  });

  it('should allow demoting admin when another admin exists', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'admin-1', role: WorkspaceRole.ADMIN }));
    repository.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'admin-2', role: WorkspaceRole.ADMIN }));

    const result = await service.execute({
      workspaceId: 'ws-1',
      targetUserId: 'admin-1',
      newRole: WorkspaceRole.AGENT,
      requestingUserId: 'sys-admin',
      isSystemAdmin: true,
    });

    expect(result.role).toBe(WorkspaceRole.AGENT);
  });

  it('should throw EntityNotFoundError when target member does not exist', async () => {
    await expect(
      service.execute({
        workspaceId: 'ws-1',
        targetUserId: 'nonexistent',
        newRole: WorkspaceRole.AGENT,
        requestingUserId: 'admin-1',
        isSystemAdmin: true,
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
