import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TransferRequest } from '../../../../src/ticket/domain/entities/transfer-request';
import { TransferRequestStatus } from '../../../../src/ticket/domain/enums/transfer-request-status.enum';
import { CreateTransferRequest } from '../../../../src/ticket/domain/services/transfer-request-create';
import { AcceptTransferRequest } from '../../../../src/ticket/domain/services/transfer-request-accept';
import { RejectTransferRequest } from '../../../../src/ticket/domain/services/transfer-request-reject';
import { CancelTransferRequest } from '../../../../src/ticket/domain/services/transfer-request-cancel';
import { EnsureTicketAssignee } from '../../../../src/ticket/domain/services/ticket-ensure-assignee';
import { AddTicketParticipant } from '../../../../src/ticket/domain/services/ticket-add-participant';
import { CreateTransferRequestCommand } from '../../../../src/ticket/application/commands/create-transfer-request.command';
import { AcceptTransferRequestCommand } from '../../../../src/ticket/application/commands/accept-transfer-request.command';
import { RejectTransferRequestCommand } from '../../../../src/ticket/application/commands/reject-transfer-request.command';
import { CancelTransferRequestCommand } from '../../../../src/ticket/application/commands/cancel-transfer-request.command';
import { GetPendingTransferRequestQuery } from '../../../../src/ticket/application/queries/get-pending-transfer-request.query';
import { MockTransferRequestRepository } from '../../../mocks/mock-transfer-request.repository';
import { FakeEventPublisher } from '../../../mocks/fake-event-publisher';
import { TicketWorld, WS_A, WS_B, makeTicket } from './ticket-security-fixtures';

function makeRequest(overrides: Partial<{ id: string; ticketId: string; requesterId: string; targetUserId: string }> = {}) {
  return new TransferRequest({
    id: overrides.id ?? 'req-a',
    ticketId: overrides.ticketId ?? 'ticket-a',
    requesterId: overrides.requesterId ?? 'agent-a',
    targetUserId: overrides.targetUserId ?? 'agent2-a',
    status: TransferRequestStatus.PENDING,
    expiresAt: new Date(Date.now() + 60_000),
    resolvedAt: null,
    createdAt: null,
  });
}

describe('Transfer requests', () => {
  let w: TicketWorld;
  let requests: MockTransferRequestRepository;
  let events: FakeEventPublisher;

  const ws = (workspaceId: string) => ({ workspaceId, workspaceName: workspaceId, workspaceSlug: workspaceId });

  beforeEach(async () => {
    w = new TicketWorld();
    requests = new MockTransferRequestRepository();
    events = new FakeEventPublisher();
    await w.tickets.create(makeTicket({ id: 'ticket-a', assigneeId: 'agent-a', status: TicketStatus.IN_PROGRESS }));
    await w.tickets.create(makeTicket({ id: 'ticket-a2', assigneeId: 'agent-a', status: TicketStatus.IN_PROGRESS }));
    await w.tickets.create(makeTicket({ id: 'ticket-b', workspaceId: WS_B, assigneeId: 'agent-b', status: TicketStatus.IN_PROGRESS }));
    w.member('admin-a', WorkspaceRole.ADMIN);
    w.member('agent-a', WorkspaceRole.AGENT);
    w.member('agent2-a', WorkspaceRole.AGENT);
    w.member('user-a', WorkspaceRole.USER);
    w.member('agent-b', WorkspaceRole.AGENT, WS_B);
    // agent-b also belongs to workspace A as an agent: membership alone must not reach B's tickets.
    w.member('agent-b', WorkspaceRole.AGENT, WS_A);
  });

  describe('create', () => {
    const create = () => new CreateTransferRequestCommand(
      new CreateTransferRequest(w.ids, w.tickets, requests),
      w.ensurePermission(), w.ensureTicketAccess(), new EnsureTicketAssignee(w.members),
      w.tickets, w.users, events, w.auditLog(), new AddTicketParticipant(w.ids, w.participants),
    );

    it('a ticket of workspace B cannot be transferred through workspace A', async () => {
      await expect(create().execute({ ticketId: 'ticket-b', targetUserId: 'agent2-a', ...ws(WS_A), userId: 'agent-b', isSystemAdmin: false }))
        .rejects.toThrow(EntityNotFoundError);
      expect(requests.getAll()).toHaveLength(0);
    });

    it('a ticket cannot be offered to someone outside the workspace, who would become a follower of it', async () => {
      w.member('outsider', WorkspaceRole.AGENT, WS_B);
      await expect(create().execute({ ticketId: 'ticket-a', targetUserId: 'outsider', ...ws(WS_A), userId: 'agent-a', isSystemAdmin: false }))
        .rejects.toThrow(DomainValidationError);
      expect(requests.getAll()).toHaveLength(0);
      expect(await w.participants.exists('ticket-a', 'outsider')).toBe(false);
    });

    it('a ticket cannot be offered to a plain user', async () => {
      await expect(create().execute({ ticketId: 'ticket-a', targetUserId: 'user-a', ...ws(WS_A), userId: 'agent-a', isSystemAdmin: false }))
        .rejects.toThrow(DomainValidationError);
    });

    it('an agent cannot transfer a ticket they have no access to', async () => {
      await w.tickets.create(makeTicket({ id: 'ticket-other', assigneeId: 'agent2-a', status: TicketStatus.IN_PROGRESS }));
      await expect(create().execute({ ticketId: 'ticket-other', targetUserId: 'agent-b', ...ws(WS_A), userId: 'agent-a', isSystemAdmin: false }))
        .rejects.toThrow(AccessDeniedError);
    });

    it('the assignee offers the ticket to another agent, who then follows it', async () => {
      const result = await create().execute({ ticketId: 'ticket-a', targetUserId: 'agent2-a', ...ws(WS_A), userId: 'agent-a', isSystemAdmin: false });
      expect(result.status).toBe('pending');
      expect(await w.participants.exists('ticket-a', 'agent2-a')).toBe(true);
      expect(events.events.map((e) => e.event)).toEqual(['transfer-request.created']);
    });
  });

  describe('pending read', () => {
    const query = () => new GetPendingTransferRequestQuery(requests, w.users, w.ensureTicketAccess());

    it('someone without access to the ticket does not see its pending transfer', async () => {
      requests.seed(makeRequest());
      await expect(query().execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'user-a', isSystemAdmin: false }))
        .rejects.toThrow(AccessDeniedError);
    });
  });

  describe('respond', () => {
    const accept = () => new AcceptTransferRequestCommand(new AcceptTransferRequest(requests, w.tickets), w.ensurePermission(), events, w.auditLog());
    const reject = () => new RejectTransferRequestCommand(new RejectTransferRequest(requests, w.tickets), w.ensurePermission(), w.tickets, events, w.auditLog());
    const cancel = () => new CancelTransferRequestCommand(new CancelTransferRequest(requests, w.tickets), w.ensurePermission(), w.tickets, events, w.auditLog());

    it('a transfer request of workspace B cannot be accepted through workspace A', async () => {
      requests.seed(makeRequest({ id: 'req-b', ticketId: 'ticket-b', requesterId: 'agent-x', targetUserId: 'agent-b' }));
      await expect(accept().execute({ ticketId: 'ticket-b', requestId: 'req-b', ...ws(WS_A), userId: 'agent-b', isSystemAdmin: false }))
        .rejects.toThrow(EntityNotFoundError);
      expect((await w.tickets.findById('ticket-b'))!.assigneeId).toBe('agent-b');
      expect((await requests.findById('req-b'))!.status).toBe(TransferRequestStatus.PENDING);
    });

    it('a request is not found under a ticket it does not belong to, so audit and events cannot be pinned on the wrong ticket', async () => {
      requests.seed(makeRequest());
      await expect(accept().execute({ ticketId: 'ticket-a2', requestId: 'req-a', ...ws(WS_A), userId: 'agent2-a', isSystemAdmin: false }))
        .rejects.toThrow(EntityNotFoundError);
      await expect(reject().execute({ ticketId: 'ticket-a2', requestId: 'req-a', ...ws(WS_A), userId: 'agent2-a', isSystemAdmin: false }))
        .rejects.toThrow(EntityNotFoundError);
      await expect(cancel().execute({ ticketId: 'ticket-a2', requestId: 'req-a', ...ws(WS_A), userId: 'agent-a', isSystemAdmin: false }))
        .rejects.toThrow(EntityNotFoundError);
      expect((await requests.findById('req-a'))!.status).toBe(TransferRequestStatus.PENDING);
    });

    it('only the target accepts or rejects', async () => {
      requests.seed(makeRequest());
      await expect(accept().execute({ ticketId: 'ticket-a', requestId: 'req-a', ...ws(WS_A), userId: 'agent-b', isSystemAdmin: false }))
        .rejects.toThrow(AccessDeniedError);
      await expect(reject().execute({ ticketId: 'ticket-a', requestId: 'req-a', ...ws(WS_A), userId: 'agent-b', isSystemAdmin: false }))
        .rejects.toThrow(AccessDeniedError);
      const result = await accept().execute({ ticketId: 'ticket-a', requestId: 'req-a', ...ws(WS_A), userId: 'agent2-a', isSystemAdmin: false });
      expect(result).toEqual({ id: 'ticket-a', assigneeId: 'agent2-a', status: 'accepted' });
    });

    it('another agent cannot cancel someone else\'s request; the requester and an admin can', async () => {
      requests.seed(makeRequest());
      await expect(cancel().execute({ ticketId: 'ticket-a', requestId: 'req-a', ...ws(WS_A), userId: 'agent-b', isSystemAdmin: false }))
        .rejects.toThrow(AccessDeniedError);

      await cancel().execute({ ticketId: 'ticket-a', requestId: 'req-a', ...ws(WS_A), userId: 'admin-a', isSystemAdmin: false });
      expect((await requests.findById('req-a'))!.status).toBe(TransferRequestStatus.CANCELLED);

      requests.seed(makeRequest({ id: 'req-a2', ticketId: 'ticket-a2' }));
      await cancel().execute({ ticketId: 'ticket-a2', requestId: 'req-a2', ...ws(WS_A), userId: 'agent-a', isSystemAdmin: false });
      expect((await requests.findById('req-a2'))!.status).toBe(TransferRequestStatus.CANCELLED);
    });
  });
});
