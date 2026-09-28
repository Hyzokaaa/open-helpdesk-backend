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

  it('lets a supervisor move an unassigned open ticket without taking it', async () => {
    seedTicket(TicketStatus.OPEN, null);
    seedMember('sup-1', WorkspaceRole.SUPERVISOR);

    const result = await run('sup-1', TicketStatus.IN_PROGRESS);

    expect(result.status).toBe(TicketStatus.IN_PROGRESS);
    const ticket = await ticketRepository.findById('ticket-1');
    expect(ticket!.assigneeId).toBeNull();
  });

  it('lets a workspace admin move a ticket assigned to someone else', async () => {
    seedTicket(TicketStatus.PENDING, 'agent-2');
    seedMember('admin-1', WorkspaceRole.ADMIN);

    const result = await run('admin-1', TicketStatus.RESOLVED);

    expect(result.status).toBe(TicketStatus.RESOLVED);
  });

  it('lets a system admin move any ticket without being a member', async () => {
    seedTicket(TicketStatus.OPEN, null);

    const result = await run('root', TicketStatus.IN_PROGRESS, true);

    expect(result.status).toBe(TicketStatus.IN_PROGRESS);
  });
});
