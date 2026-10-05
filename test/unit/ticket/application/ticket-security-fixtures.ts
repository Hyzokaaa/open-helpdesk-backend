import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { User } from '../../../../src/user/domain/entities/user';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { EnsureTicketAccess } from '../../../../src/ticket/domain/services/ticket-ensure-access';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { MockTicketParticipantRepository } from '../../../mocks/mock-ticket-participant.repository';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockAuditLogRepository } from '../../../mocks/mock-audit-log.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

/** Workspace A ("ws-a") is the caller's; workspace B ("ws-b") is someone else's tenant. */
export const WS_A = 'ws-a';
export const WS_B = 'ws-b';

export function makeTicket(overrides: Partial<{
  id: string; workspaceId: string; reporterId: string; assigneeId: string | null; status: TicketStatus;
}> = {}): Ticket {
  return new Ticket({
    id: overrides.id ?? 'ticket-a',
    name: 'Printer on fire',
    description: 'original',
    priority: TicketPriority.MEDIUM,
    status: overrides.status ?? TicketStatus.PENDING,
    categoryId: 'cat-a',
    workspaceId: overrides.workspaceId ?? WS_A,
    reporterId: overrides.reporterId ?? 'reporter-a',
    assigneeId: overrides.assigneeId ?? null,
    ticketNumber: 1,
    tagIds: [],
    customFields: {},
    discardReason: null,
    resolvedAt: null,
    resolvedById: null,
    createdAt: null,
    deletedAt: null,
  });
}

export function makeUser(id: string, email = `${id}@example.com`): User {
  return new User({
    id, email, password: 'x', firstName: id, lastName: 'Test', isActive: true,
    isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'light',
  });
}

export function makeMember(userId: string, role: WorkspaceRole, workspaceId = WS_A): WorkspaceMember {
  return new WorkspaceMember({ id: `mem-${workspaceId}-${userId}`, workspaceId, userId, role });
}

export class TicketWorld {
  readonly tickets = new MockTicketRepository();
  readonly members = new MockWorkspaceMemberRepository();
  readonly participants = new MockTicketParticipantRepository();
  readonly users = new MockUserRepository();
  readonly audit = new MockAuditLogRepository();
  readonly ids = new FakeIdGenerator();

  ensurePermission(): EnsureWorkspacePermission {
    return new EnsureWorkspacePermission(this.members);
  }

  ensureTicketAccess(): EnsureTicketAccess {
    return new EnsureTicketAccess(this.tickets, this.ensurePermission(), this.participants);
  }

  auditLog(): CreateAuditLogEntry {
    return new CreateAuditLogEntry(this.ids, this.audit);
  }

  private readonly seededUsers = new Set<string>();

  /** Seeds a member of `workspaceId` and, once, the matching user account. */
  member(userId: string, role: WorkspaceRole, workspaceId = WS_A): void {
    this.members.seed(makeMember(userId, role, workspaceId));
    if (this.seededUsers.has(userId)) return;
    this.seededUsers.add(userId);
    this.users.seed(makeUser(userId));
  }
}
