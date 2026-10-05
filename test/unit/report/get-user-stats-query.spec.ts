import { AccessDeniedError, EntityNotFoundError } from '../../../src/shared/domain/errors';
import { GetUserStatsQuery } from '../../../src/report/application/queries/get-user-stats.query';
import { EnsureWorkspacePermission } from '../../../src/workspace/domain/services/workspace-ensure-permission';
import { WorkspaceMember } from '../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { User } from '../../../src/user/domain/entities/user';
import { MockUserRepository } from '../../mocks/mock-user.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';

const WS = 'ws-1';

/** Aggregates are raw SQL; every row answers zero, which is enough to see who may ask. */
const zeroDataSource = {
  query: async (sql: string) => (/GROUP BY/i.test(sql) ? [] : [{ count: '0', total: '0', avg_hours: null, score: null }]),
} as any;

describe('GET /workspaces/:slug/stats/:userId (GetUserStatsQuery)', () => {
  let query: GetUserStatsQuery;
  let users: MockUserRepository;

  const run = (requesterId: string, targetUserId: string, isSystemAdmin = false) =>
    query.execute({ workspaceId: WS, requesterId, targetUserId, isSystemAdmin, dateFrom: null, dateTo: null });

  beforeEach(() => {
    users = new MockUserRepository();
    for (const id of ['supervisor', 'agent', 'agent-2', 'stranger']) {
      users.seed(new User({
        id, email: `${id}@test.local`, password: 'x', firstName: id, lastName: 'X',
        isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
      }));
    }
    const members = new MockWorkspaceMemberRepository();
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: WS, userId: 'supervisor', role: WorkspaceRole.SUPERVISOR }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: WS, userId: 'agent', role: WorkspaceRole.AGENT }));
    members.seed(new WorkspaceMember({ id: 'm-3', workspaceId: WS, userId: 'agent-2', role: WorkspaceRole.AGENT }));
    // 'stranger' belongs to another workspace on the same instance.
    members.seed(new WorkspaceMember({ id: 'm-4', workspaceId: 'ws-2', userId: 'stranger', role: WorkspaceRole.ADMIN }));

    query = new GetUserStatsQuery(zeroDataSource, new EnsureWorkspacePermission(members), users, members);
  });

  it('does not reveal the name and email of a user outside the workspace to a supervisor', async () => {
    await expect(run('supervisor', 'stranger')).rejects.toThrow(EntityNotFoundError);
  });

  it('does not reveal it to a system admin either, since it is not this workspace\'s data', async () => {
    await expect(run('sys', 'stranger', true)).rejects.toThrow(EntityNotFoundError);
  });

  it('does not let an agent read another agent\'s stats', async () => {
    await expect(run('agent', 'agent-2')).rejects.toThrow(AccessDeniedError);
  });

  it('lets a member read their own stats', async () => {
    const result = await run('agent', 'agent');
    expect(result.user).toBeNull();
  });

  it('lets a supervisor read a member\'s stats', async () => {
    const result = await run('supervisor', 'agent');
    expect(result.user?.email).toBe('agent@test.local');
  });
});
