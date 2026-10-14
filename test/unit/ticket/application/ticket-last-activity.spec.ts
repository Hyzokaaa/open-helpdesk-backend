import { GetTicketQuery } from '../../../../src/ticket/application/queries/get-ticket.query';
import { AuditLogEntry } from '../../../../src/audit-log/domain/entities/audit-log-entry';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { TicketWorld, WS_A, makeTicket } from './ticket-security-fixtures';

const at = (iso: string) => new Date(iso);
const entry = (id: string, userId: string | null, createdAt: string, entityId = 'ticket-a') => new AuditLogEntry({
  id, action: 'comment-created', entityType: 'ticket', entityId, userId, workspaceId: WS_A,
  metadata: null, category: 'ticket', level: 'info', source: 'ui', createdAt: at(createdAt),
});

describe('When a ticket last had activity', () => {
  let w: TicketWorld;
  const get = () => new GetTicketQuery(w.tickets, w.ensureTicketAccess(), undefined, w.audit)
    .execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'admin', isSystemAdmin: false });

  beforeEach(async () => {
    w = new TicketWorld();
    w.member('admin', WorkspaceRole.ADMIN);
    const ticket = makeTicket({});
    ticket.createdAt = at('2026-10-01T09:00:00Z');
    await w.tickets.create(ticket);
  });

  it('is the latest thing a person did to it', async () => {
    await w.audit.create(entry('e1', 'admin', '2026-10-02T09:00:00Z'));
    await w.audit.create(entry('e2', 'admin', '2026-10-05T09:00:00Z'));
    await w.audit.create(entry('e3', 'admin', '2026-10-09T09:00:00Z', 'ticket-other'));
    expect((await get()).lastActivityAt).toEqual(at('2026-10-05T09:00:00Z'));
  });

  it('leaves out what the system did on its own, such as an SLA breach', async () => {
    await w.audit.create(entry('e1', 'admin', '2026-10-02T09:00:00Z'));
    await w.audit.create(entry('e2', null, '2026-10-07T09:00:00Z'));
    expect((await get()).lastActivityAt).toEqual(at('2026-10-02T09:00:00Z'));
  });

  it('falls back to its creation when no entries are left', async () => {
    expect((await get()).lastActivityAt).toEqual(at('2026-10-01T09:00:00Z'));
  });
});
