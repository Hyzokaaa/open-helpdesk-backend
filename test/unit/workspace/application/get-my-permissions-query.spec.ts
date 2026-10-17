import { GetMyPermissionsQuery } from '../../../../src/workspace/application/queries/get-my-permissions.query';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { PERMISSIONS } from '../../../../src/workspace/domain/permissions';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';

describe('GetMyPermissionsQuery', () => {
  let repository: MockWorkspaceMemberRepository;
  let query: GetMyPermissionsQuery;

  beforeEach(() => {
    repository = new MockWorkspaceMemberRepository();
    query = new GetMyPermissionsQuery(repository);
  });

  it('returns the member role with its permissions', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', role: WorkspaceRole.AGENT }));

    const result = await query.execute({ workspaceId: 'ws-1', userId: 'user-1' });

    expect(result.role).toBe(WorkspaceRole.AGENT);
    expect(result.permissions).toContain(PERMISSIONS.TICKET_PICKUP);
  });

  it('returns no permissions and a null role for a non-member', async () => {
    const result = await query.execute({ workspaceId: 'ws-1', userId: 'user-1' });

    expect(result).toEqual({ permissions: [], role: null });
  });

  it('gives a system admin who is not a member admin permissions and a null role', async () => {
    const result = await query.execute({ workspaceId: 'ws-1', userId: 'sys-1', isSystemAdmin: true });

    expect(result.role).toBeNull();
    expect(result.permissions).toContain(PERMISSIONS.TICKET_DELETE);
  });

  it('reports the real role of a system admin who is a member', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'sys-1', role: WorkspaceRole.USER }));

    const result = await query.execute({ workspaceId: 'ws-1', userId: 'sys-1', isSystemAdmin: true });

    expect(result.role).toBe(WorkspaceRole.USER);
    expect(result.permissions).toContain(PERMISSIONS.TICKET_DELETE);
  });
});
