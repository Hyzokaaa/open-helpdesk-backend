import { MatrixNoticeService } from '../../../src/matrix/infrastructure/nest/services/matrix-notice.service';
import { SlaBreachCheckerService } from '../../../src/ticket/infrastructure/nest/services/sla-breach-checker.service';
import { FakeEventPublisher } from '../../mocks/fake-event-publisher';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockAuditLogRepository } from '../../mocks/mock-audit-log.repository';

const workspace = { workspaceId: 'ws-1', workspaceName: 'Acme', workspaceSlug: 'acme' };

describe('MatrixNoticeService', () => {
  const service = (findByWorkspaceId: (id: string) => Promise<unknown[]>) => {
    const rooms = { findByWorkspaceId: jest.fn(findByWorkspaceId) };
    const none = {} as any;
    const instance = new MatrixNoticeService(none, none, none, none, rooms as any, none, none, none, none, none, none, none, none, none, none);
    return { instance, rooms };
  };

  it('never lets a Matrix failure reach the ticket change that caused it', async () => {
    const { instance } = service(async () => { throw new Error('database down'); });
    await expect(instance.onTicketCreated({ ticketId: 't-1', ...workspace } as any)).resolves.toBeUndefined();
    await expect(instance.onComment({ ticketId: 't-1', commentId: 'c-1', authorId: 'u', commentContent: 'x', ...workspace } as any)).resolves.toBeUndefined();
  });

  it('skips the quiet status changes that only follow another notice', async () => {
    const { instance, rooms } = service(async () => []);
    await instance.onStatusChanged({ ticketId: 't-1', newStatus: 'in-progress', oldStatus: 'open', changedById: 'u', quiet: true, ...workspace } as any);
    expect(rooms.findByWorkspaceId).not.toHaveBeenCalled();
    await instance.onStatusChanged({ ticketId: 't-1', newStatus: 'resolved', oldStatus: 'open', changedById: 'u', ...workspace } as any);
    expect(rooms.findByWorkspaceId).toHaveBeenCalledWith('ws-1');
  });

  it('leaves an assignment caused by a status change to that change\'s own notice', async () => {
    const { instance, rooms } = service(async () => []);
    await instance.onTicketAssigned({ ticketId: 't-1', newAssigneeId: 'u', previousAssigneeId: null, followsStatusChange: true, ...workspace } as any);
    expect(rooms.findByWorkspaceId).not.toHaveBeenCalled();
    await instance.onTicketAssigned({ ticketId: 't-1', newAssigneeId: 'u', previousAssigneeId: null, ...workspace } as any);
    expect(rooms.findByWorkspaceId).toHaveBeenCalledWith('ws-1');
  });
});

describe('SLA breach check', () => {
  it('still flags and audits breaches, and now also announces each one', async () => {
    const dataSource = {
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith('SELECT')) return [{ id: 'ws-1', slaPolicy: { firstResponse: { high: 4 }, resolution: { high: 24 } } }];
        if (sql.includes('"firstResponseBreached" = true')) return [[{ id: 't-1' }], 1];
        return [[{ id: 't-2' }], 1];
      }),
    };
    const audit = new MockAuditLogRepository();
    const events = new FakeEventPublisher();

    await new SlaBreachCheckerService(dataSource as any, new FakeIdGenerator(), audit as any, events as any).check();

    expect(audit.entries.map((e) => [e.action, e.entityId])).toEqual([['sla-first-response-breached', 't-1'], ['sla-resolution-breached', 't-2']]);
    expect(events.events).toEqual([
      { event: 'ticket.slaBreached', data: { ticketId: 't-1', workspaceId: 'ws-1', target: 'first-response', targetHours: 4 } },
      { event: 'ticket.slaBreached', data: { ticketId: 't-2', workspaceId: 'ws-1', target: 'resolution', targetHours: 24 } },
    ]);
  });
});
