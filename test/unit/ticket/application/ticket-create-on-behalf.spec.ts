import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { CreateUser } from '../../../../src/user/domain/services/user-create';
import { AddWorkspaceMember } from '../../../../src/workspace/domain/services/workspace-add-member';
import { ResolveOnBehalfOfCommand } from '../../../../src/ticket/application/commands/resolve-on-behalf-of.command';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';
import { TicketWorld, WS_A, WS_B, makeUser } from './ticket-security-fixtures';

describe('Opening a ticket on behalf of someone', () => {
  let w: TicketWorld;

  const resolve = () => new ResolveOnBehalfOfCommand(
    w.ensurePermission(), w.users, w.members,
    new CreateUser(w.ids, w.users, new FakePasswordHasher()),
    new AddWorkspaceMember(w.ids, w.members),
  );

  beforeEach(() => {
    w = new TicketWorld();
    w.member('user-a', WorkspaceRole.USER);
    w.member('agent-a', WorkspaceRole.AGENT);
    w.member('admin-b', WorkspaceRole.ADMIN, WS_B);
  });

  it('a plain user cannot create accounts by opening tickets on behalf of new addresses', async () => {
    await expect(resolve().execute({ email: 'victim@example.com', workspaceId: WS_A, userId: 'user-a', isSystemAdmin: false }))
      .rejects.toThrow(AccessDeniedError);
    expect(await w.users.findByEmail('victim@example.com')).toBeNull();
  });

  it('a plain user cannot pull an existing account into the workspace', async () => {
    w.users.seed(makeUser('stranger', 'stranger@example.com'));
    await expect(resolve().execute({ email: 'stranger@example.com', workspaceId: WS_A, userId: 'user-a', isSystemAdmin: false }))
      .rejects.toThrow(AccessDeniedError);
    expect(await w.members.findByWorkspaceAndUser(WS_A, 'stranger')).toBeNull();
  });

  it('an admin of workspace B cannot enroll people into workspace A', async () => {
    await expect(resolve().execute({ email: 'victim@example.com', workspaceId: WS_A, userId: 'admin-b', isSystemAdmin: false }))
      .rejects.toThrow(AccessDeniedError);
    expect(await w.users.findByEmail('victim@example.com')).toBeNull();
  });

  it('an agent opens a ticket for a new contact, who becomes a user of the workspace', async () => {
    const result = await resolve().execute({ email: ' New.Contact@Example.com ', workspaceId: WS_A, userId: 'agent-a', isSystemAdmin: false });
    expect(result.email).toBe('new.contact@example.com');
    const member = await w.members.findByWorkspaceAndUser(WS_A, result.userId);
    expect(member!.role).toBe(WorkspaceRole.USER);
  });
});
