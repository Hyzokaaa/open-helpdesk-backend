import { AuditLogEntry } from '../../../../src/audit-log/domain/entities/audit-log-entry';
import { ListTicketActivityQuery } from '../../../../src/ticket/application/queries/list-ticket-activity.query';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { EnsureTicketAccess } from '../../../../src/ticket/domain/services/ticket-ensure-access';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { AccessDeniedError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { MockAuditLogRepository } from '../../../mocks/mock-audit-log.repository';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockTicketParticipantRepository } from '../../../mocks/mock-ticket-participant.repository';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';

// ws-1 holds ticket-1 (opened by "reporter", assigned to "agent"); ws-2 holds ticket-2
function makeTicket(id: string, workspaceId: string) {
  return new Ticket({
    id, name: 'Printer', description: '', priority: TicketPriority.MEDIUM, status: TicketStatus.PENDING,
    categoryId: 'cat', workspaceId, reporterId: 'reporter', assigneeId: 'agent', ticketNumber: 1,
    tagIds: [], customFields: {}, discardReason: null, resolvedAt: null, resolvedById: null,
    createdAt: null, deletedAt: null,
  });
}

describe('Ticket activity', () => {
  let tickets: MockTicketRepository;
  let participants: MockTicketParticipantRepository;
  let members: MockWorkspaceMemberRepository;
  let auditLog: MockAuditLogRepository;

  const list = (ticketId: string, userId: string, workspaceId = 'ws-1') => {
    const ensurePermission = new EnsureWorkspacePermission(members);
    const ensureTicketAccess = new EnsureTicketAccess(tickets, ensurePermission, participants);
    return new ListTicketActivityQuery(auditLog, ensurePermission, ensureTicketAccess, new MockUserRepository())
      .execute({ ticketId, workspaceId, userId, isSystemAdmin: false });
  };

  beforeEach(async () => {
    tickets = new MockTicketRepository();
    participants = new MockTicketParticipantRepository();
    members = new MockWorkspaceMemberRepository();
    auditLog = new MockAuditLogRepository();

    await tickets.create(makeTicket('ticket-1', 'ws-1'));
    await tickets.create(makeTicket('ticket-2', 'ws-2'));
    for (const [userId, role] of [
      ['admin', WorkspaceRole.ADMIN], ['supervisor', WorkspaceRole.SUPERVISOR], ['agent', WorkspaceRole.AGENT],
      ['other-agent', WorkspaceRole.AGENT], ['reporter', WorkspaceRole.USER],
    ] as const) {
      members.seed(new WorkspaceMember({ id: `m-${userId}`, workspaceId: 'ws-1', userId, role }));
    }
    await auditLog.create(new AuditLogEntry({
      id: 'entry-1', action: 'ticket-status-changed', entityType: 'ticket', entityId: 'ticket-1',
      userId: 'agent', workspaceId: 'ws-1', metadata: null, category: 'ticket', level: 'info', source: 'ui',
    }));
  });

  it('shows the activity to admins, supervisors and the assigned agent', async () => {
    for (const userId of ['admin', 'supervisor', 'agent']) {
      const items = await list('ticket-1', userId);
      expect(items.map((i) => i.id)).toEqual(['entry-1']);
    }
  });

  it('hides it from an agent who cannot see the ticket', async () => {
    await expect(list('ticket-1', 'other-agent')).rejects.toThrow(AccessDeniedError);
  });

  it('hides it from the customer who opened the ticket', async () => {
    await expect(list('ticket-1', 'reporter')).rejects.toThrow(AccessDeniedError);
  });

  it('reports a ticket of another workspace as missing', async () => {
    await expect(list('ticket-2', 'admin')).rejects.toThrow(EntityNotFoundError);
  });
});
