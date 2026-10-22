import { ChangeTicketStatusCommand } from '../../../../src/ticket/application/commands/change-ticket-status.command';
import { ChangeTicketStatus } from '../../../../src/ticket/domain/services/ticket-change-status';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { EnsureTicketAssignee } from '../../../../src/ticket/domain/services/ticket-ensure-assignee';
import { NEEDS_ASSIGNEE_MESSAGE } from '../../../../src/ticket/domain/ticket-assignment-rule';
import { BulkChangeStatusCommand } from '../../../../src/ticket/application/commands/bulk-change-status.command';
import { AuditAction } from '../../../../src/audit-log/domain/enums/audit-action.enum';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { TicketDiscardReason } from '../../../../src/ticket/domain/enums/ticket-discard-reason.enum';
import { AuditLogEntry } from '../../../../src/audit-log/domain/entities/audit-log-entry';

describe('ChangeTicketStatusCommand', () => {
  let command: ChangeTicketStatusCommand;
  let ticketRepository: MockTicketRepository;
  let memberRepository: MockWorkspaceMemberRepository;
  let emitted: string[];
  let audited: AuditLogEntry[];

  const seedTicket = (status: TicketStatus, assigneeId: string | null) => {
    ticketRepository.create(new Ticket({
      id: 'ticket-1',
      name: 'Printer on fire',
      description: '',
      priority: TicketPriority.LOW,
      status,
      categoryId: 'cat-1',
      workspaceId: 'ws-1',
      reporterId: 'reporter-1',
      assigneeId,
      resolvedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      tagIds: [],
      resolvedById: null,
      customFields: {},
      discardReason: null,
    }));
  };

  const seedMember = (userId: string, role: WorkspaceRole) => {
    memberRepository.seed(new WorkspaceMember({ id: `m-${userId}`, workspaceId: 'ws-1', userId, role }));
  };

  const run = (userId: string, status: TicketStatus, isSystemAdmin = false, discardReason?: TicketDiscardReason) =>
    command.execute({
      ticketId: 'ticket-1',
      status,
      discardReason,
      workspaceId: 'ws-1',
      workspaceName: 'Testing',
      workspaceSlug: 'testing',
      userId,
      isSystemAdmin,
    });

  beforeEach(() => {
    ticketRepository = new MockTicketRepository();
    memberRepository = new MockWorkspaceMemberRepository();
    emitted = [];
    audited = [];
    const eventPublisher = { emit: (name: string) => { emitted.push(name); } };
    const auditLogRepository = { create: async (entry: AuditLogEntry) => { audited.push(entry); }, findAll: async () => ({ data: [], total: 0, page: 1, limit: 10 }) };
    const createAuditLog = new CreateAuditLogEntry(new FakeIdGenerator(), auditLogRepository as any);
    command = new ChangeTicketStatusCommand(
      new ChangeTicketStatus(ticketRepository),
      ticketRepository,
      new EnsureWorkspacePermission(memberRepository),
      eventPublisher,
      createAuditLog,
      new EnsureTicketAssignee(memberRepository),
    );
  });

  it('rejects an agent moving an open ticket nobody has taken', async () => {
    seedTicket(TicketStatus.OPEN, null);
    seedMember('agent-1', WorkspaceRole.AGENT);

    await expect(run('agent-1', TicketStatus.IN_PROGRESS)).rejects.toThrow(AccessDeniedError);

    const ticket = await ticketRepository.findById('ticket-1');
    expect(ticket!.status).toBe(TicketStatus.OPEN);
    expect(emitted).toEqual([]);
  });

  it('rejects an agent moving a ticket assigned to someone else', async () => {
    seedTicket(TicketStatus.PENDING, 'agent-2');
    seedMember('agent-1', WorkspaceRole.AGENT);

    await expect(run('agent-1', TicketStatus.IN_PROGRESS)).rejects.toThrow(AccessDeniedError);
  });

  it('lets an agent discard an open ticket straight from the queue and records who did it', async () => {
    seedTicket(TicketStatus.OPEN, null);
    seedMember('agent-1', WorkspaceRole.AGENT);

    const result = await run('agent-1', TicketStatus.DISCARDED, false, TicketDiscardReason.SPAM);

    expect(result.status).toBe(TicketStatus.DISCARDED);
    expect(audited).toHaveLength(1);
    expect(audited[0].userId).toBe('agent-1');
    expect(audited[0].metadata).toMatchObject({
      before: { status: TicketStatus.OPEN },
      after: { status: TicketStatus.DISCARDED },
      discardReason: TicketDiscardReason.SPAM,
    });
  });

  it('does not let an agent discard an unassigned ticket that has left the queue', async () => {
    seedTicket(TicketStatus.PENDING, null);
    seedMember('agent-1', WorkspaceRole.AGENT);

    await expect(run('agent-1', TicketStatus.DISCARDED, false, TicketDiscardReason.SPAM)).rejects.toThrow(AccessDeniedError);
  });

  it('lets an agent move a ticket assigned to them and keeps the assignment', async () => {
    seedTicket(TicketStatus.PENDING, 'agent-1');
    seedMember('agent-1', WorkspaceRole.AGENT);

    const result = await run('agent-1', TicketStatus.IN_PROGRESS);

    expect(result.status).toBe(TicketStatus.IN_PROGRESS);
    const ticket = await ticketRepository.findById('ticket-1');
    expect(ticket!.assigneeId).toBe('agent-1');
  });

  it('a supervisor moving an unassigned open ticket to work takes it, told as an assignment', async () => {
    seedTicket(TicketStatus.OPEN, null);
    seedMember('sup-1', WorkspaceRole.SUPERVISOR);

    const result = await run('sup-1', TicketStatus.IN_PROGRESS);

    expect(result.status).toBe(TicketStatus.IN_PROGRESS);
    expect(result.assigneeId).toBe('sup-1');
    expect(emitted).toEqual(['ticket.statusChanged', 'ticket.assigned']);
    expect(audited.map((e) => e.action)).toEqual([AuditAction.TICKET_STATUS_CHANGED, AuditAction.TICKET_ASSIGNED]);
    expect(audited[1].metadata).toMatchObject({ reason: 'status-changed' });
  });

  it('moving to the queue lets go of whoever had it, told as an unassignment', async () => {
    seedTicket(TicketStatus.IN_PROGRESS, 'agent-2');
    seedMember('sup-1', WorkspaceRole.SUPERVISOR);

    const result = await run('sup-1', TicketStatus.OPEN);

    expect(result).toMatchObject({ status: TicketStatus.OPEN, assigneeId: null });
    expect(emitted).toEqual(['ticket.statusChanged', 'ticket.assigned']);
  });

  it('a status that keeps the assignee is not told as an assignment', async () => {
    seedTicket(TicketStatus.PENDING, 'agent-2');
    seedMember('sup-1', WorkspaceRole.SUPERVISOR);

    await run('sup-1', TicketStatus.IN_PROGRESS);

    expect(emitted).toEqual(['ticket.statusChanged']);
  });

  it('bulk does not take tickets: work with nobody assigned is refused', async () => {
    seedTicket(TicketStatus.OPEN, null);
    seedMember('sup-1', WorkspaceRole.SUPERVISOR);

    await expect(command.execute({ ticketId: 'ticket-1', status: TicketStatus.PENDING, workspaceId: 'ws-1', workspaceName: 'Testing', workspaceSlug: 'testing', userId: 'sup-1', isSystemAdmin: false, takeIfUnassigned: false }))
      .rejects.toThrow(NEEDS_ASSIGNEE_MESSAGE);

    const results = await new BulkChangeStatusCommand(command).execute({ ticketIds: ['ticket-1'], status: TicketStatus.PENDING, workspaceId: 'ws-1', workspaceName: 'Testing', workspaceSlug: 'testing', userId: 'sup-1', isSystemAdmin: false });
    expect(results).toEqual([expect.objectContaining({ ticketId: 'ticket-1', success: false, needsAssignee: true })]);
    expect((await ticketRepository.findById('ticket-1'))!.status).toBe(TicketStatus.OPEN);
  });

  it('lets a workspace admin move a ticket assigned to someone else', async () => {
    seedTicket(TicketStatus.PENDING, 'agent-2');
    seedMember('admin-1', WorkspaceRole.ADMIN);

    const result = await run('admin-1', TicketStatus.RESOLVED);

    expect(result.status).toBe(TicketStatus.RESOLVED);
  });

  it('lets a system admin move any ticket without being a member', async () => {
    seedTicket(TicketStatus.OPEN, null);

    const result = await run('root', TicketStatus.RESOLVED, true);

    expect(result.status).toBe(TicketStatus.RESOLVED);
  });

  it('a system admin who is not a member cannot take an unassigned ticket to work', async () => {
    seedTicket(TicketStatus.OPEN, null);

    await expect(run('root', TicketStatus.IN_PROGRESS, true)).rejects.toThrow(NEEDS_ASSIGNEE_MESSAGE);
  });
});
