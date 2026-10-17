import { ResolveTicketEmailLink } from '../../../src/email/domain/ticket-email-link';
import { EnsureTicketPortalAccess } from '../../../src/ticket/domain/services/ticket-portal-access-ensure';
import { MockTicketPortalAccessRepository } from '../../mocks/mock-ticket-portal-access.repository';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { ResolveTicketReplyMailbox } from '../../../src/email/domain/services/ticket-reply-mailbox-resolve';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { MailboxType } from '../../../src/mailbox/domain/enums/mailbox-type.enum';

describe('ResolveTicketEmailLink', () => {
  let accesses: MockTicketPortalAccessRepository;
  let resolve: ResolveTicketEmailLink;
  const base = { frontendUrl: 'https://help.x.com', workspaceSlug: 'acme', ticketId: 'T1', isSystemAdmin: false };

  beforeEach(() => {
    accesses = new MockTicketPortalAccessRepository();
    resolve = new ResolveTicketEmailLink(new EnsureTicketPortalAccess(new FakeIdGenerator(), accesses));
  });

  it("sends each customer to the portal through their own link, the same one every time", async () => {
    const reporter = await resolve.execute({ ...base, userId: 'reporter', role: WorkspaceRole.USER });
    const colleague = await resolve.execute({ ...base, userId: 'colleague', role: WorkspaceRole.USER });

    expect(reporter).toMatch(/^https:\/\/help\.x\.com\/portal\/tickets\/[0-9a-f-]{36}$/);
    expect(colleague).toMatch(/\/portal\/tickets\//);
    expect(colleague).not.toBe(reporter);
    expect(await resolve.execute({ ...base, userId: 'reporter', role: WorkspaceRole.USER })).toBe(reporter);
    expect(accesses.all().map((a) => a.userId)).toEqual(['reporter', 'colleague']);
  });

  it('sends the team, system admins and people no longer in the workspace to the dashboard, without a portal link', async () => {
    const dashboard = 'https://help.x.com/dashboard/workspaces/acme/tickets/T1';
    for (const role of [WorkspaceRole.AGENT, WorkspaceRole.SUPERVISOR, WorkspaceRole.ADMIN]) {
      expect(await resolve.execute({ ...base, userId: 'u', role })).toBe(dashboard);
    }
    expect(await resolve.execute({ ...base, userId: 'admin', role: WorkspaceRole.USER, isSystemAdmin: true })).toBe(dashboard);
    expect(await resolve.execute({ ...base, userId: 'gone', role: null })).toBe(dashboard);
    expect(await resolve.execute({ ...base, userId: null, role: WorkspaceRole.USER })).toBe(dashboard);
    expect(accesses.all()).toEqual([]);
  });
});

describe('ResolveTicketReplyMailbox', () => {
  const mailbox = (id: string, isActive: boolean, type = MailboxType.IMAP) => ({ id, address: `${id}@x.com`, isActive, type }) as any;
  const repo = (byId: Record<string, any>, all: any[]) => ({
    findById: async (id: string) => byId[id] ?? null,
    findAllByWorkspaceId: async () => all,
  }) as any;

  it("uses the ticket's own mailbox while it is active", async () => {
    const own = mailbox('own', true);
    expect(await new ResolveTicketReplyMailbox(repo({ own }, [own, mailbox('other', true)])).execute({ ticketMailboxId: 'own', workspaceId: 'ws' })).toBe(own);
  });

  it('falls back to an active mailbox of the workspace, IMAP first', async () => {
    const webhook = mailbox('hook', true, MailboxType.WEBHOOK);
    const imap = mailbox('imap', true);
    const resolve = new ResolveTicketReplyMailbox(repo({ old: mailbox('old', false) }, [mailbox('off', false), webhook, imap]));
    expect(await resolve.execute({ ticketMailboxId: null, workspaceId: 'ws' })).toBe(imap);
    expect(await resolve.execute({ ticketMailboxId: 'old', workspaceId: 'ws' })).toBe(imap);
  });

  it('is null when the workspace reads no mailbox', async () => {
    expect(await new ResolveTicketReplyMailbox(repo({}, [mailbox('off', false)])).execute({ workspaceId: 'ws' })).toBeNull();
  });
});
