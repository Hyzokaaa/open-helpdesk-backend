import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { PickupTicket } from '../../../../src/ticket/domain/services/ticket-pickup';
import { AssignTicket } from '../../../../src/ticket/domain/services/ticket-assign';
import { EnsureTicketAssignee } from '../../../../src/ticket/domain/services/ticket-ensure-assignee';
import { PickupTicketCommand } from '../../../../src/ticket/application/commands/pickup-ticket.command';
import { AssignTicketCommand } from '../../../../src/ticket/application/commands/assign-ticket.command';
import { AuditAction } from '../../../../src/audit-log/domain/enums/audit-action.enum';
import { FakeEventPublisher } from '../../../mocks/fake-event-publisher';
import { TicketWorld, WS_A, WS_B, makeTicket } from './ticket-security-fixtures';

describe('Picking up and assigning tickets', () => {
  let w: TicketWorld;

  beforeEach(async () => {
    w = new TicketWorld();
    await w.tickets.create(makeTicket({ id: 'ticket-a', status: TicketStatus.OPEN }));
    w.member('admin-a', WorkspaceRole.ADMIN);
    w.member('agent-a', WorkspaceRole.AGENT);
    w.member('user-a', WorkspaceRole.USER);
    w.member('agent-b', WorkspaceRole.AGENT, WS_B);
  });

  describe('pickup', () => {
    const pickup = () => new PickupTicketCommand(new PickupTicket(w.tickets), w.ensurePermission(), w.auditLog());

    it('an agent of workspace B cannot pick up an open ticket of workspace A', async () => {
      await expect(pickup().execute({ ticketId: 'ticket-a', workspaceId: WS_B, userId: 'agent-b', isSystemAdmin: false }))
        .rejects.toThrow(EntityNotFoundError);
      const ticket = await w.tickets.findById('ticket-a');
      expect(ticket!.assigneeId).toBeNull();
      expect(ticket!.status).toBe(TicketStatus.OPEN);
    });

    it('a plain user cannot pick up a ticket', async () => {
      await expect(pickup().execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'user-a', isSystemAdmin: false }))
        .rejects.toThrow(AccessDeniedError);
    });

    it('an agent of the workspace picks up its open ticket, and it is audited there', async () => {
      const result = await pickup().execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'agent-a', isSystemAdmin: false });
      expect(result).toEqual({ id: 'ticket-a', status: TicketStatus.PENDING, assigneeId: 'agent-a' });
      expect(w.audit.entries[0].workspaceId).toBe(WS_A);
    });

    it('tells people about the pickup as a status change and an assignment made by the agent to themselves', async () => {
      const events = new FakeEventPublisher();
      await new PickupTicketCommand(new PickupTicket(w.tickets), w.ensurePermission(), w.auditLog(), events)
        .execute({ ticketId: 'ticket-a', workspaceId: WS_A, workspaceName: 'A', workspaceSlug: 'a', userId: 'agent-a', isSystemAdmin: false });
      expect(events.events.map((e) => e.event)).toEqual(['ticket.statusChanged', 'ticket.assigned']);
      expect(events.events[0].data).toMatchObject({ oldStatus: TicketStatus.OPEN, newStatus: TicketStatus.PENDING, changedById: 'agent-a' });
      expect(events.events[1].data).toMatchObject({ newAssigneeId: 'agent-a', previousAssigneeId: null, assignedById: 'agent-a' });
    });
  });

  describe('assign', () => {
    let events: FakeEventPublisher;
    beforeEach(() => { events = new FakeEventPublisher(); });
    const assign = () => new AssignTicketCommand(
      new AssignTicket(w.tickets), w.tickets, w.ensurePermission(), events, w.auditLog(), new EnsureTicketAssignee(w.members),
    );
    const statusEntries = () => w.audit.entries.filter((e) => e.action === AuditAction.TICKET_STATUS_CHANGED).map((e) => e.metadata);
    const props = (assigneeId: string | null) => ({
      ticketId: 'ticket-a', assigneeId, assigneeLabel: null, previousAssigneeLabel: null,
      workspaceId: WS_A, workspaceName: 'A', workspaceSlug: 'a', userId: 'admin-a', isSystemAdmin: false,
    });

    it('a ticket of workspace A cannot be handed to an agent of workspace B', async () => {
      await expect(assign().execute(props('agent-b'))).rejects.toThrow(DomainValidationError);
      expect((await w.tickets.findById('ticket-a'))!.assigneeId).toBeNull();
    });

    it('a ticket cannot be assigned to a plain user, who could then manage it', async () => {
      await expect(assign().execute(props('user-a'))).rejects.toThrow(DomainValidationError);
      expect((await w.tickets.findById('ticket-a'))!.assigneeId).toBeNull();
    });

    it('an agent of the workspace can be assigned, and a ticket can still be unassigned', async () => {
      expect((await assign().execute(props('agent-a'))).assigneeId).toBe('agent-a');
      expect((await assign().execute(props(null))).assigneeId).toBeNull();
    });

    it('assigning an open ticket makes it pending, and leaving it unassigned opens it again, both audited', async () => {
      await assign().execute(props('agent-a'));
      expect((await w.tickets.findById('ticket-a'))!.status).toBe(TicketStatus.PENDING);
      await assign().execute(props(null));
      expect((await w.tickets.findById('ticket-a'))!.status).toBe(TicketStatus.OPEN);
      expect(statusEntries()).toEqual([
        expect.objectContaining({ before: { status: 'open' }, after: { status: 'pending' }, reason: 'assigned' }),
        expect.objectContaining({ before: { status: 'pending' }, after: { status: 'open' }, reason: 'unassigned' }),
      ]);
    });

    it('tells webhooks and open screens about the status change, quietly, since the assignment already notified people', async () => {
      await assign().execute(props('agent-a'));
      const statusEvents = events.events.filter((e) => e.event === 'ticket.statusChanged').map((e) => e.data);
      expect(statusEvents).toEqual([expect.objectContaining({ oldStatus: 'open', newStatus: 'pending', quiet: true })]);
    });

    it('a ticket in progress left unassigned goes back to the queue; a closed one keeps its status', async () => {
      await w.tickets.create(makeTicket({ id: 'ticket-ip', status: TicketStatus.IN_PROGRESS, assigneeId: 'agent-a' }));
      await w.tickets.create(makeTicket({ id: 'ticket-done', status: TicketStatus.RESOLVED, assigneeId: 'agent-a' }));
      await assign().execute({ ...props(null), ticketId: 'ticket-ip' });
      await assign().execute({ ...props(null), ticketId: 'ticket-done' });
      expect((await w.tickets.findById('ticket-ip'))!.status).toBe(TicketStatus.OPEN);
      expect((await w.tickets.findById('ticket-done'))!.status).toBe(TicketStatus.RESOLVED);
      expect(statusEntries()).toHaveLength(1);
    });

    it('the assigned agent lets go of their own ticket, without being able to assign', async () => {
      await assign().execute(props('agent-a'));
      const result = await assign().execute({ ...props(null), userId: 'agent-a' });
      expect(result.assigneeId).toBeNull();
      expect(w.audit.entries.filter((e) => e.action === AuditAction.TICKET_ASSIGNED).at(-1)!.userId).toBe('agent-a');
    });

    it('an agent cannot unassign a ticket that is not theirs, nor hand theirs to someone else', async () => {
      w.member('agent2-a', WorkspaceRole.AGENT);
      await assign().execute(props('agent2-a'));
      await expect(assign().execute({ ...props(null), userId: 'agent-a' })).rejects.toThrow(AccessDeniedError);
      await assign().execute(props('agent-a'));
      await expect(assign().execute({ ...props('agent2-a'), userId: 'agent-a' })).rejects.toThrow(AccessDeniedError);
      expect((await w.tickets.findById('ticket-a'))!.assigneeId).toBe('agent-a');
    });
  });
});
