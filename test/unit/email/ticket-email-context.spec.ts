import { ticketLinkFor } from '../../../src/email/domain/ticket-email-link';
import { ResolveTicketReplyMailbox } from '../../../src/email/domain/services/ticket-reply-mailbox-resolve';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { MailboxType } from '../../../src/mailbox/domain/enums/mailbox-type.enum';

describe('ticketLinkFor', () => {
  const base = { frontendUrl: 'https://help.x.com', workspaceSlug: 'acme', ticketId: 'T1', portalToken: 'tok' };

  it('sends customers to the portal and the team to the dashboard', () => {
    expect(ticketLinkFor({ ...base, role: WorkspaceRole.USER, isSystemAdmin: false })).toBe('https://help.x.com/portal/tickets/tok');
    expect(ticketLinkFor({ ...base, role: null, isSystemAdmin: false })).toBe('https://help.x.com/portal/tickets/tok');
    for (const role of [WorkspaceRole.AGENT, WorkspaceRole.SUPERVISOR, WorkspaceRole.ADMIN]) {
      expect(ticketLinkFor({ ...base, role, isSystemAdmin: false })).toBe('https://help.x.com/dashboard/workspaces/acme/tickets/T1');
    }
    expect(ticketLinkFor({ ...base, role: null, isSystemAdmin: true })).toContain('/dashboard/');
  });

  it('falls back to the dashboard when the ticket has no portal link', () => {
    expect(ticketLinkFor({ ...base, portalToken: null, role: WorkspaceRole.USER, isSystemAdmin: false })).toContain('/dashboard/');
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
