import { EnsureTicketPortalAccess } from '../../../../src/ticket/domain/services/ticket-portal-access-ensure';
import { ResolveTicketPortalAccess } from '../../../../src/ticket/domain/services/ticket-portal-access-resolve';
import { RevokeTicketPortalAccess } from '../../../../src/ticket/domain/services/ticket-portal-access-revoke';
import { ResolveOwnTicketPortalAccess } from '../../../../src/ticket/domain/services/ticket-portal-access-resolve-own';
import { EntityNotFoundError, PortalClosedError } from '../../../../src/shared/domain/errors';
import { TicketPortalAccess } from '../../../../src/ticket/domain/entities/ticket-portal-access';
import { User } from '../../../../src/user/domain/entities/user';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { PortalAccessCleanupService } from '../../../../src/ticket/infrastructure/nest/services/portal-access-cleanup.service';
import { MockTicketPortalAccessRepository } from '../../../mocks/mock-ticket-portal-access.repository';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { makeTicket } from '../application/ticket-security-fixtures';

const user = (id: string) => new User({
  id, email: `${id}@x.com`, password: 'x', firstName: id, lastName: '', isActive: true,
  isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'light',
});

describe('Ticket portal links', () => {
  let accesses: MockTicketPortalAccessRepository;
  let tickets: MockTicketRepository;
  let users: MockUserRepository;
  let workspaces: MockWorkspaceRepository;

  beforeEach(async () => {
    accesses = new MockTicketPortalAccessRepository(new Map([['ticket-a', 'ws-a'], ['ticket-b', 'ws-b']]));
    tickets = new MockTicketRepository();
    users = new MockUserRepository();
    workspaces = new MockWorkspaceRepository();
    await tickets.create(makeTicket({ id: 'ticket-a', workspaceId: 'ws-a', reporterId: 'reporter' }));
    workspaces.seed(new Workspace({ id: 'ws-a', name: 'A', slug: 'a', description: '' }));
    users.seed(user('reporter'));
    users.seed(user('colleague'));
  });

  const resolve = () => new ResolveTicketPortalAccess(accesses, tickets, workspaces, users);
  const ensure = () => new EnsureTicketPortalAccess(new FakeIdGenerator(), accesses);

  describe('EnsureTicketPortalAccess', () => {
    it('gives each person one link per ticket and returns it again afterwards', async () => {
      const first = await ensure().execute({ ticketId: 'ticket-a', userId: 'colleague' });
      const again = await ensure().execute({ ticketId: 'ticket-a', userId: 'colleague' });
      const reporter = await ensure().execute({ ticketId: 'ticket-a', userId: 'reporter' });

      expect(again.token).toBe(first.token);
      expect(reporter.token).not.toBe(first.token);
      expect(accesses.all()).toHaveLength(2);
    });

    it('returns the link created meanwhile when two emails race to create it', async () => {
      const winner = new TicketPortalAccess({ id: 'won', ticketId: 'ticket-a', userId: 'colleague', token: 'tok-won' });
      const racing = new MockTicketPortalAccessRepository();
      racing.findByTicketAndUser = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
      racing.create = jest.fn().mockRejectedValue(new Error('duplicate key'));

      const access = await new EnsureTicketPortalAccess(new FakeIdGenerator(), racing).execute({ ticketId: 'ticket-a', userId: 'colleague' });
      expect(access).toBe(winner);
    });
  });

  describe('ResolveTicketPortalAccess', () => {
    it("opens the ticket as the link's owner", async () => {
      const own = await ensure().execute({ ticketId: 'ticket-a', userId: 'colleague' });
      const resolved = await resolve().execute(own.token);
      expect(resolved?.ticket.getId()).toBe('ticket-a');
      expect(resolved?.user.getId()).toBe('colleague');
      expect(resolved?.workspace.getId()).toBe('ws-a');
    });

    it('opens nothing for an unknown token, a deleted ticket or workspace, or a deactivated owner', async () => {
      expect(await resolve().execute('nope')).toBeNull();

      const own = await ensure().execute({ ticketId: 'ticket-a', userId: 'colleague' });
      (await users.findById('colleague'))!.isActive = false;
      expect(await resolve().execute(own.token)).toBeNull();

      const reporter = await ensure().execute({ ticketId: 'ticket-a', userId: 'reporter' });
      workspaces = new MockWorkspaceRepository();
      expect(await resolve().execute(reporter.token)).toBeNull();

      await accesses.create(new TicketPortalAccess({ id: 'x', ticketId: 'ticket-gone', userId: 'reporter', token: 'tok-gone' }));
      expect(await resolve().execute('tok-gone')).toBeNull();
    });

    it('does not open while the portal is closed, and opens again once it is reopened', async () => {
      const own = await ensure().execute({ ticketId: 'ticket-a', userId: 'reporter' });
      const workspace = (await workspaces.findById('ws-a'))!;

      workspace.portalEnabled = false;
      await expect(resolve().execute(own.token)).rejects.toThrow(PortalClosedError);
      // A dead link stays a plain "not found": closing the portal does not tell which links were real
      expect(await resolve().execute('nope')).toBeNull();

      workspace.portalEnabled = true;
      expect((await resolve().execute(own.token))?.user.getId()).toBe('reporter');
    });
  });

  describe('ResolveOwnTicketPortalAccess', () => {
    const resolveOwn = () => new ResolveOwnTicketPortalAccess(accesses, tickets, workspaces);

    it("leads the link's owner, once signed in, to the ticket in the dashboard, also with the portal closed", async () => {
      const own = await ensure().execute({ ticketId: 'ticket-a', userId: 'reporter' });
      (await workspaces.findById('ws-a'))!.portalEnabled = false;

      expect(await resolveOwn().execute({ token: own.token, userId: 'reporter' })).toEqual({ workspaceSlug: 'a', ticketId: 'ticket-a' });
    });

    it("is not found for someone else's link, an unknown one, or one whose ticket is gone", async () => {
      const own = await ensure().execute({ ticketId: 'ticket-a', userId: 'reporter' });
      await expect(resolveOwn().execute({ token: own.token, userId: 'colleague' })).rejects.toThrow(EntityNotFoundError);
      await expect(resolveOwn().execute({ token: 'nope', userId: 'reporter' })).rejects.toThrow(EntityNotFoundError);

      await accesses.create(new TicketPortalAccess({ id: 'x', ticketId: 'ticket-gone', userId: 'reporter', token: 'tok-gone' }));
      await expect(resolveOwn().execute({ token: 'tok-gone', userId: 'reporter' })).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('RevokeTicketPortalAccess', () => {
    it("removes a follower's link and keeps the reporter's", async () => {
      const colleague = await ensure().execute({ ticketId: 'ticket-a', userId: 'colleague' });
      const reporter = await ensure().execute({ ticketId: 'ticket-a', userId: 'reporter' });
      const revoke = new RevokeTicketPortalAccess(tickets, accesses);

      await revoke.execute({ ticketId: 'ticket-a', userId: 'colleague' });
      await revoke.execute({ ticketId: 'ticket-a', userId: 'reporter' });

      expect(await accesses.findByToken(colleague.token)).toBeNull();
      expect(await accesses.findByToken(reporter.token)).not.toBeNull();
    });
  });

  describe('leaving a workspace', () => {
    it("removes the person's links to that workspace's tickets only", async () => {
      const inA = await ensure().execute({ ticketId: 'ticket-a', userId: 'colleague' });
      const inB = await ensure().execute({ ticketId: 'ticket-b', userId: 'colleague' });
      const other = await ensure().execute({ ticketId: 'ticket-a', userId: 'reporter' });

      await new PortalAccessCleanupService(accesses as any).onMemberRemoved({ workspaceId: 'ws-a', userId: 'colleague' });

      expect(await accesses.findByToken(inA.token)).toBeNull();
      expect(await accesses.findByToken(inB.token)).not.toBeNull();
      expect(await accesses.findByToken(other.token)).not.toBeNull();
    });
  });
});
