import { AccessDeniedError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { GetWorkspaceQuery } from '../../../../src/workspace/application/queries/get-workspace.query';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';

describe('GET /workspaces/:slug (GetWorkspaceQuery)', () => {
  let query: GetWorkspaceQuery;

  beforeEach(() => {
    const workspaces = new MockWorkspaceRepository();
    workspaces.seed(new Workspace({
      id: 'ws-1', name: 'Acme', slug: 'acme', description: '',
      customDomain: 'help.acme.test', domainVerificationToken: 'secret-token',
    }));
    const members = new MockWorkspaceMemberRepository();
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'member', role: WorkspaceRole.USER }));
    query = new GetWorkspaceQuery(workspaces, new EnsureWorkspacePermission(members));
  });

  it('does not reveal a workspace\'s settings to an authenticated user who is not a member', async () => {
    await expect(
      query.execute({ slug: 'acme', userId: 'outsider', isSystemAdmin: false }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('answers a member of any role', async () => {
    const result = await query.execute({ slug: 'acme', userId: 'member', isSystemAdmin: false });
    expect(result.slug).toBe('acme');
  });

  it('answers a system admin who is not a member', async () => {
    const result = await query.execute({ slug: 'acme', userId: 'sys', isSystemAdmin: true });
    expect(result.id).toBe('ws-1');
  });

  it('still answers not-found for an unknown slug', async () => {
    await expect(
      query.execute({ slug: 'nope', userId: 'member', isSystemAdmin: false }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
