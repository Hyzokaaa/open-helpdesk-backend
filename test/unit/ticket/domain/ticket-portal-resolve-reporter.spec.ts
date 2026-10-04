import { ResolvePortalReporter } from '../../../../src/ticket/domain/services/ticket-portal-resolve-reporter';
import { CreateUser } from '../../../../src/user/domain/services/user-create';
import { AddWorkspaceMember } from '../../../../src/workspace/domain/services/workspace-add-member';
import { User } from '../../../../src/user/domain/entities/user';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';

describe('ResolvePortalReporter', () => {
  let users: MockUserRepository;
  let members: MockWorkspaceMemberRepository;
  let service: ResolvePortalReporter;

  beforeEach(() => {
    users = new MockUserRepository();
    members = new MockWorkspaceMemberRepository();
    const ids = new FakeIdGenerator();
    service = new ResolvePortalReporter(
      users,
      members,
      new CreateUser(ids, users, new FakePasswordHasher()),
      new AddWorkspaceMember(ids, members),
    );
    users.seed(new User({
      id: 'victim', email: 'ceo@other.com', password: 'hashed:x', firstName: 'Real', lastName: 'Person',
      isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
    }));
    users.seed(new User({
      id: 'agent', email: 'agent@acme.com', password: 'hashed:x', firstName: 'Agent', lastName: 'A',
      isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
    }));
    members.seed(new WorkspaceMember({ id: 'm-agent', workspaceId: 'ws-1', userId: 'agent', role: WorkspaceRole.AGENT }));
  });

  it('adds an existing account as a USER member, as an email from that address would', async () => {
    const reporter = await service.execute({ workspaceId: 'ws-1', email: 'ceo@other.com', name: 'Attacker' });

    expect(reporter.user.getId()).toBe('victim');
    expect(reporter.isMember).toBe(true);
    expect((await members.findByWorkspaceAndUser('ws-1', 'victim'))!.role).toBe(WorkspaceRole.USER);
  });

  it('does not hand the portal link to whoever typed an existing address', async () => {
    // The link lets its holder read the ticket and comment as the reporter; it now only reaches their inbox.
    const outsider = await service.execute({ workspaceId: 'ws-1', email: 'ceo@other.com', name: 'x' });
    const member = await service.execute({ workspaceId: 'ws-1', email: 'agent@acme.com', name: 'x' });

    expect(outsider.mayRevealPortalLink).toBe(false);
    expect(member.mayRevealPortalLink).toBe(false);
    expect(member.isMember).toBe(true);
  });

  it('leaves the existing account untouched', async () => {
    await service.execute({ workspaceId: 'ws-1', email: 'ceo@other.com', name: '<b>Attacker</b>' });
    const victim = await users.findById('victim');
    expect(victim!.firstName).toBe('Real');
  });

  it('still creates a new address as an unverified USER member and shows them their link', async () => {
    const reporter = await service.execute({ workspaceId: 'ws-1', email: 'new@customer.com', name: 'New <i>Customer</i>' });

    expect(reporter.mayRevealPortalLink).toBe(true);
    expect(reporter.isMember).toBe(true);
    expect(reporter.user.autoCreated).toBe(true);
    expect(reporter.user.isEmailVerified).toBe(false);
    expect(reporter.user.firstName).toBe('New Customer');
    const member = await members.findByWorkspaceAndUser('ws-1', reporter.user.getId());
    expect(member!.role).toBe(WorkspaceRole.USER);
  });
});
