import { EnsureTicketAccess } from '../../../../src/ticket/domain/services/ticket-ensure-access';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketParticipant } from '../../../../src/ticket/domain/entities/ticket-participant';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { ParticipantRole } from '../../../../src/ticket/domain/enums/participant-role.enum';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketCategory } from '../../../../src/ticket/domain/enums/ticket-category.enum';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockTicketParticipantRepository } from '../../../mocks/mock-ticket-participant.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';

function makeTicket(overrides: Partial<{ id: string; workspaceId: string; creatorId: string; assigneeId: string | null; status: string }> = {}) {
  return new Ticket({
    id: overrides.id ?? 'ticket-1',
    name: 'Test',
    description: '',
    priority: TicketPriority.MEDIUM,
    status: (overrides.status as TicketStatus) ?? TicketStatus.PENDING,
    category: TicketCategory.ISSUE,
    workspaceId: overrides.workspaceId ?? 'ws-1',
    creatorId: overrides.creatorId ?? 'creator-1',
    assigneeId: overrides.assigneeId ?? null,
    ticketNumber: 1,
    tagIds: [],
    customFields: {},
    discardReason: null,
    portalToken: null,
    firstResponseAt: null,
    resolvedAt: null,
    firstResponseBreached: false,
    resolutionBreached: false,
    resolvedById: null,
    createdAt: null,
    deletedAt: null,
  });
}

function makeMember(userId: string, role: WorkspaceRole, workspaceId = 'ws-1') {
  return new WorkspaceMember({ id: `mem-${userId}`, workspaceId, userId, role });
}

function makeParticipant(ticketId: string, userId: string) {
  return new TicketParticipant({ id: `part-${userId}`, ticketId, userId, role: ParticipantRole.FOLLOWER });
}

describe('EnsureTicketAccess', () => {
  let ticketRepo: MockTicketRepository;
  let participantRepo: MockTicketParticipantRepository;
  let memberRepo: MockWorkspaceMemberRepository;
  let service: EnsureTicketAccess;

  beforeEach(() => {
    ticketRepo = new MockTicketRepository();
    participantRepo = new MockTicketParticipantRepository();
    memberRepo = new MockWorkspaceMemberRepository();
    const ensurePermission = new EnsureWorkspacePermission(memberRepo);
    service = new EnsureTicketAccess(ticketRepo, ensurePermission, participantRepo);
  });

  it('should return full for system admin', async () => {
    const result = await service.execute({
      ticketId: 'ticket-1', userId: 'admin', workspaceId: 'ws-1', isSystemAdmin: true,
    });
    expect(result).toBe('full');
  });

  it('should return full for admin/supervisor role (TICKET_VIEW permission)', async () => {
    memberRepo.seed(makeMember('admin-user', WorkspaceRole.ADMIN));
    await ticketRepo.create(makeTicket());

    const result = await service.execute({
      ticketId: 'ticket-1', userId: 'admin-user', workspaceId: 'ws-1', isSystemAdmin: false,
    });
    expect(result).toBe('full');
  });

  it('should return full for agent assigned to ticket', async () => {
    memberRepo.seed(makeMember('agent-1', WorkspaceRole.AGENT));
    await ticketRepo.create(makeTicket({ assigneeId: 'agent-1' }));

    const result = await service.execute({
      ticketId: 'ticket-1', userId: 'agent-1', workspaceId: 'ws-1', isSystemAdmin: false,
    });
    expect(result).toBe('full');
  });

  it('should return full for agent when ticket is open', async () => {
    memberRepo.seed(makeMember('agent-1', WorkspaceRole.AGENT));
    await ticketRepo.create(makeTicket({ status: 'open' }));

    const result = await service.execute({
      ticketId: 'ticket-1', userId: 'agent-1', workspaceId: 'ws-1', isSystemAdmin: false,
    });
    expect(result).toBe('full');
  });

  it('should return full for reporter who created the ticket', async () => {
    memberRepo.seed(makeMember('reporter-1', WorkspaceRole.REPORTER));
    await ticketRepo.create(makeTicket({ creatorId: 'reporter-1' }));

    const result = await service.execute({
      ticketId: 'ticket-1', userId: 'reporter-1', workspaceId: 'ws-1', isSystemAdmin: false,
    });
    expect(result).toBe('full');
  });

  it('should return readonly for agent who is only a follower', async () => {
    memberRepo.seed(makeMember('agent-2', WorkspaceRole.AGENT));
    await ticketRepo.create(makeTicket({ assigneeId: 'agent-1' }));
    participantRepo.seed(makeParticipant('ticket-1', 'agent-2'));

    const result = await service.execute({
      ticketId: 'ticket-1', userId: 'agent-2', workspaceId: 'ws-1', isSystemAdmin: false,
    });
    expect(result).toBe('readonly');
  });

  it('should throw AccessDeniedError for agent with no access at all', async () => {
    memberRepo.seed(makeMember('agent-3', WorkspaceRole.AGENT));
    await ticketRepo.create(makeTicket({ assigneeId: 'agent-1' }));

    await expect(
      service.execute({ ticketId: 'ticket-1', userId: 'agent-3', workspaceId: 'ws-1', isSystemAdmin: false }),
    ).rejects.toThrow(AccessDeniedError);
  });

  it('ensureFull should pass for full access', async () => {
    memberRepo.seed(makeMember('agent-1', WorkspaceRole.AGENT));
    await ticketRepo.create(makeTicket({ assigneeId: 'agent-1' }));

    await expect(
      service.ensureFull({ ticketId: 'ticket-1', userId: 'agent-1', workspaceId: 'ws-1', isSystemAdmin: false }),
    ).resolves.toBeUndefined();
  });

  it('ensureFull should throw for readonly access', async () => {
    memberRepo.seed(makeMember('agent-2', WorkspaceRole.AGENT));
    await ticketRepo.create(makeTicket({ assigneeId: 'agent-1' }));
    participantRepo.seed(makeParticipant('ticket-1', 'agent-2'));

    await expect(
      service.ensureFull({ ticketId: 'ticket-1', userId: 'agent-2', workspaceId: 'ws-1', isSystemAdmin: false }),
    ).rejects.toThrow(AccessDeniedError);
  });
});
