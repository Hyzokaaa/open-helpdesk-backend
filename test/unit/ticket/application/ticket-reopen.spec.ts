import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketReopenReason } from '../../../../src/ticket/domain/enums/ticket-reopen-reason.enum';
import { ReopenTicket } from '../../../../src/ticket/domain/services/ticket-reopen';
import { PickupTicket } from '../../../../src/ticket/domain/services/ticket-pickup';
import { ReopenTicketCommand } from '../../../../src/ticket/application/commands/reopen-ticket.command';
import { requesterReopenUntil } from '../../../../src/ticket/domain/ticket-requester-reopen';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../src/audit-log/domain/enums/audit-action.enum';
import { AccessDeniedError, DomainValidationError } from '../../../../src/shared/domain/errors';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { MockAuditLogRepository } from '../../../mocks/mock-audit-log.repository';
import { FakeEventPublisher } from '../../../mocks/fake-event-publisher';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

const WS = 'ws-1';
const RESOLVED_AT = new Date('2026-09-18T14:02:00Z');
const NOTE = 'The printer still prints blank pages';

describe('Reopening a ticket', () => {
  let tickets: MockTicketRepository;
  let members: MockWorkspaceMemberRepository;
  let audit: MockAuditLogRepository;
  let events: FakeEventPublisher;

  const ticket = (overrides: Partial<ConstructorParameters<typeof Ticket>[0]> = {}) => new Ticket({
    id: 't1', name: 'Printer', description: '', priority: TicketPriority.MEDIUM, status: TicketStatus.RESOLVED,
    categoryId: 'c', workspaceId: WS, reporterId: 'customer', assigneeId: 'carlos', resolvedAt: RESOLVED_AT,
    resolvedById: 'carlos', firstResolvedAt: RESOLVED_AT, createdAt: new Date('2026-09-17T10:00:00Z'), deletedAt: null,
    tagIds: [], customFields: {}, discardReason: null, ...overrides,
  });
  const member = (userId: string, role: WorkspaceRole) =>
    members.seed(new WorkspaceMember({ id: `m-${userId}`, workspaceId: WS, userId, role }));
  const service = () => new ReopenTicket(tickets, members);
  const command = () => new ReopenTicketCommand(service(), new EnsureWorkspacePermission(members), events, new CreateAuditLogEntry(new FakeIdGenerator('a'), audit));
  const base = { workspaceName: 'Support', workspaceSlug: 'support', workspaceId: WS, isSystemAdmin: false };

  beforeEach(() => {
    tickets = new MockTicketRepository();
    members = new MockWorkspaceMemberRepository();
    audit = new MockAuditLogRepository();
    events = new FakeEventPublisher();
    member('carlos', WorkspaceRole.AGENT);
    member('stephen', WorkspaceRole.SUPERVISOR);
    member('agent2', WorkspaceRole.AGENT);
    member('customer', WorkspaceRole.USER);
  });

  it('goes back to In progress with whoever had it, keeping who had resolved it', async () => {
    await tickets.create(ticket());
    const { ticket: t, reopen } = await service().execute({ ticketId: 't1', workspaceId: WS, userId: 'stephen', reason: TicketReopenReason.ISSUE_PERSISTS, note: NOTE });
    expect(t.status).toBe(TicketStatus.IN_PROGRESS);
    expect(t.assigneeId).toBe('carlos');
    // The current resolution empties (reports and SLA count it as open); the first one stays
    expect(t.resolvedAt).toBeNull();
    expect(t.resolvedById).toBeNull();
    expect(t.firstResolvedAt).toEqual(RESOLVED_AT);
    expect(t.reopenCount).toBe(1);
    expect(reopen).toMatchObject({ byId: 'stephen', previousResolvedById: 'carlos', previousResolvedAt: RESOLVED_AT.toISOString(), fromStatus: 'resolved', note: NOTE });
  });

  it('goes to the queue when whoever had it is no longer on the team', async () => {
    await tickets.create(ticket({ assigneeId: 'gone', resolvedById: 'gone' }));
    const { ticket: t } = await service().execute({ ticketId: 't1', workspaceId: WS, userId: 'stephen', reason: TicketReopenReason.OTHER, note: NOTE });
    expect(t.status).toBe(TicketStatus.OPEN);
    expect(t.assigneeId).toBeNull();
  });

  it('goes back to the status the team chooses: pending keeps whoever had it, open is the queue', async () => {
    await tickets.create(ticket());
    const { ticket: pending } = await service().execute({ ticketId: 't1', workspaceId: WS, userId: 'stephen', reason: TicketReopenReason.OTHER, note: NOTE, status: TicketStatus.PENDING });
    expect(pending.status).toBe(TicketStatus.PENDING);
    expect(pending.assigneeId).toBe('carlos');

    await tickets.create(ticket({ id: 't2' }));
    const { ticket: queued } = await service().execute({ ticketId: 't2', workspaceId: WS, userId: 'stephen', reason: TicketReopenReason.OTHER, note: NOTE, status: TicketStatus.OPEN });
    expect(queued.status).toBe(TicketStatus.OPEN);
    expect(queued.assigneeId).toBeNull();
  });

  it('refuses the queue with somebody assigned, and work with nobody falls back to the queue', async () => {
    await tickets.create(ticket());
    await expect(service().execute({ ticketId: 't1', workspaceId: WS, userId: 'stephen', reason: TicketReopenReason.OTHER, note: NOTE, status: TicketStatus.OPEN, assigneeId: 'agent2' }))
      .rejects.toThrow(DomainValidationError);
    await expect(service().execute({ ticketId: 't1', workspaceId: WS, userId: 'stephen', reason: TicketReopenReason.OTHER, note: NOTE, status: TicketStatus.RESOLVED }))
      .rejects.toThrow(DomainValidationError);

    await tickets.create(ticket({ id: 't2', assigneeId: 'gone', resolvedById: 'gone' }));
    const { ticket: t } = await service().execute({ ticketId: 't2', workspaceId: WS, userId: 'stephen', reason: TicketReopenReason.OTHER, note: NOTE, status: TicketStatus.PENDING });
    expect(t.status).toBe(TicketStatus.OPEN);
    expect(t.assigneeId).toBeNull();
  });

  it('sending it to the queue needs the assign permission, and the requester cannot choose', async () => {
    await tickets.create(ticket());
    await expect(command().execute({ ...base, ticketId: 't1', userId: 'carlos', reason: TicketReopenReason.OTHER, note: NOTE, status: TicketStatus.OPEN }))
      .rejects.toThrow(AccessDeniedError);
    const agentPending = await command().execute({ ...base, ticketId: 't1', userId: 'carlos', reason: TicketReopenReason.OTHER, note: NOTE, status: TicketStatus.PENDING });
    expect(agentPending.status).toBe(TicketStatus.PENDING);

    await tickets.create(ticket({ id: 't2' }));
    const now = new Date(RESOLVED_AT.getTime() + 24 * 3600 * 1000);
    const { ticket: t } = await service().execute({ ticketId: 't2', workspaceId: WS, userId: 'customer', byRequester: true, reason: TicketReopenReason.REQUESTER, note: 'still broken', status: TicketStatus.OPEN, now });
    expect(t.status).toBe(TicketStatus.IN_PROGRESS);
  });

  it('asks the team for a reason and at least 20 characters, and only for closed tickets', async () => {
    await tickets.create(ticket());
    await expect(service().execute({ ticketId: 't1', workspaceId: WS, userId: 'stephen', reason: TicketReopenReason.OTHER, note: '  too short          ' }))
      .rejects.toThrow(DomainValidationError);
    await expect(service().execute({ ticketId: 't1', workspaceId: WS, userId: 'stephen', reason: TicketReopenReason.REQUESTER, note: NOTE }))
      .rejects.toThrow(DomainValidationError);
    await tickets.create(ticket({ id: 't2', status: TicketStatus.IN_PROGRESS, resolvedAt: null }));
    await expect(service().execute({ ticketId: 't2', workspaceId: WS, userId: 'stephen', reason: TicketReopenReason.OTHER, note: NOTE }))
      .rejects.toThrow(DomainValidationError);
  });

  it('lets the requester reopen a resolved ticket within 14 days, not a discarded one', async () => {
    await tickets.create(ticket());
    const now = new Date(RESOLVED_AT.getTime() + 13 * 24 * 3600 * 1000);
    expect(requesterReopenUntil(ticket(), 'customer', now)).not.toBeNull();
    expect(requesterReopenUntil(ticket(), 'carlos', now)).toBeNull();
    const late = new Date(RESOLVED_AT.getTime() + 15 * 24 * 3600 * 1000);
    expect(requesterReopenUntil(ticket(), 'customer', late)).toBeNull();
    await expect(service().execute({ ticketId: 't1', workspaceId: WS, userId: 'customer', byRequester: true, reason: TicketReopenReason.REQUESTER, note: 'still broken', now: late }))
      .rejects.toThrow(DomainValidationError);
    await expect(service().execute({ ticketId: 't1', workspaceId: WS, userId: 'agent2', byRequester: true, reason: TicketReopenReason.REQUESTER, note: 'still broken', now }))
      .rejects.toThrow(AccessDeniedError);
    const { reopen } = await service().execute({ ticketId: 't1', workspaceId: WS, userId: 'customer', byRequester: true, reason: TicketReopenReason.OTHER, note: 'still broken', now });
    expect(reopen.reason).toBe(TicketReopenReason.REQUESTER);

    await tickets.create(ticket({ id: 't3', status: TicketStatus.DISCARDED }));
    await expect(service().execute({ ticketId: 't3', workspaceId: WS, userId: 'customer', byRequester: true, reason: TicketReopenReason.REQUESTER, note: 'x', now }))
      .rejects.toThrow(DomainValidationError);
  });

  it('needs the reopen permission, and the assign one to choose who takes it', async () => {
    await tickets.create(ticket());
    await expect(command().execute({ ...base, ticketId: 't1', userId: 'customer', reason: TicketReopenReason.OTHER, note: NOTE }))
      .rejects.toThrow(AccessDeniedError);
    await expect(command().execute({ ...base, ticketId: 't1', userId: 'carlos', reason: TicketReopenReason.OTHER, note: NOTE, assigneeId: 'agent2' }))
      .rejects.toThrow(AccessDeniedError);
    const result = await command().execute({ ...base, ticketId: 't1', userId: 'stephen', reason: TicketReopenReason.OTHER, note: NOTE, assigneeId: 'agent2' });
    expect(result.assigneeId).toBe('agent2');
  });

  it('tells screens quietly, tells people with its own event, and is audited as a warning', async () => {
    await tickets.create(ticket());
    await command().execute({ ...base, ticketId: 't1', userId: 'carlos', reason: TicketReopenReason.WORK_MISSING, note: NOTE });
    expect(events.events.map((e) => e.event)).toEqual(['ticket.statusChanged', 'ticket.reopened']);
    expect(events.events[0].data).toMatchObject({ quiet: true, oldStatus: 'resolved', newStatus: 'in-progress' });
    expect(events.events[1].data).toMatchObject({ reason: 'work-missing', note: NOTE, previousResolvedById: 'carlos', reopenCount: 1 });
    const [entry] = audit.entries;
    expect(entry.action).toBe(AuditAction.TICKET_REOPENED);
    expect(entry.level).toBe('warning');
  });

  it('names the people in the audit entry, as the other ticket entries do', async () => {
    await tickets.create(ticket({ assigneeId: null }));
    const describe = async (id: string) => `${id.toUpperCase()} (${id}@x.test)`;
    const named = new ReopenTicketCommand(service(), new EnsureWorkspacePermission(members), events, new CreateAuditLogEntry(new FakeIdGenerator('a'), audit), describe);
    await named.execute({ ...base, ticketId: 't1', userId: 'stephen', reason: TicketReopenReason.OTHER, note: NOTE });
    expect(audit.entries[0].metadata).toMatchObject({
      before: { status: 'resolved', assignee: null },
      after: { status: 'in-progress', assignee: 'CARLOS (carlos@x.test)' },
      previousResolvedBy: 'CARLOS (carlos@x.test)',
    });
    expect(audit.entries[0].metadata).not.toHaveProperty('previousResolvedById');
  });

  it('picking a ticket up as resolved records who resolved it', async () => {
    await tickets.create(ticket({ status: TicketStatus.OPEN, assigneeId: null, resolvedAt: null, resolvedById: null, firstResolvedAt: null }));
    const t = await new PickupTicket(tickets).execute({ ticketId: 't1', workspaceId: WS, userId: 'carlos', status: TicketStatus.RESOLVED });
    expect(t.resolvedById).toBe('carlos');
    expect(t.resolvedAt).toBeInstanceOf(Date);
    expect(t.firstResolvedAt).toEqual(t.resolvedAt);
  });
});
