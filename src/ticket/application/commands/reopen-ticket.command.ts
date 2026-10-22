import { EventPublisher } from '../../../shared/domain/event-publisher';
import { Command } from '../../../shared/domain/command';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { TicketReopenReason } from '../../domain/enums/ticket-reopen-reason.enum';
import { ReopenTicket } from '../../domain/services/ticket-reopen';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { StatusChangedEvent, TicketReopenedEvent } from '../../../email/domain/events';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { TicketReopen } from '../../domain/ticket-reopen';
import { DescribeUser } from '../../../user/domain/user-audit-label';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';

interface Props {
  ticketId: string;
  reason: TicketReopenReason;
  note: string;
  /** Who takes it; left out, whoever had it. Choosing needs the assign permission. */
  assigneeId?: string | null;
  /** Where it goes back to (open, pending or in-progress); left out, In progress. */
  status?: TicketStatus;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  isSystemAdmin: boolean;
  /** The requester from the portal: no team permission, the portal rules apply. */
  byRequester?: boolean;
  /** Set when the action came through the public API, with the key that made it. */
  apiKeyId?: string;
}

export interface ReopenTicketResponse {
  id: string;
  status: string;
  assigneeId: string | null;
  reopenCount: number;
  lastReopen: TicketReopen;
}

export class ReopenTicketCommand implements Command<Props, ReopenTicketResponse> {
  constructor(
    private readonly reopenTicket: ReopenTicket,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly eventPublisher: EventPublisher,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly describeUser: DescribeUser = async () => null,
  ) {}

  async execute(props: Props): Promise<ReopenTicketResponse> {
    if (!props.byRequester) {
      const ctx = await this.ensurePermission.execute({
        workspaceId: props.workspaceId,
        userId: props.userId,
        permission: PERMISSIONS.TICKET_REOPEN,
        isSystemAdmin: props.isSystemAdmin,
      });
      // Sending it to the queue is choosing nobody, so it needs the same permission
      const choosesWho = props.assigneeId !== undefined || props.status === TicketStatus.OPEN;
      if (choosesWho && !props.isSystemAdmin && !hasPermission(ctx.role, PERMISSIONS.TICKET_ASSIGN)) {
        throw new AccessDeniedError('Choosing who takes it needs the assign permission');
      }
    }

    const { ticket, previousStatus, previousAssigneeId, reopen } = await this.reopenTicket.execute({
      ticketId: props.ticketId,
      workspaceId: props.workspaceId,
      userId: props.userId,
      byRequester: props.byRequester,
      reason: props.reason,
      note: props.note,
      assigneeId: props.byRequester ? undefined : props.assigneeId,
      status: props.byRequester ? undefined : props.status,
    });

    const workspace = { workspaceId: props.workspaceId, workspaceName: props.workspaceName, workspaceSlug: props.workspaceSlug };
    // Quiet: screens and webhooks follow the status, while the people are told by the reopen itself
    const statusChanged: StatusChangedEvent = {
      ticketId: props.ticketId,
      ticketName: ticket.name,
      oldStatus: previousStatus,
      newStatus: ticket.status,
      changedById: props.userId,
      ...workspace,
      quiet: true,
    };
    this.eventPublisher.emit('ticket.statusChanged', statusChanged);
    const reopened: TicketReopenedEvent = {
      ticketId: props.ticketId,
      ticketName: ticket.name,
      oldStatus: previousStatus,
      newStatus: ticket.status,
      reopenedById: props.userId,
      byRequester: !!props.byRequester,
      reason: reopen.reason,
      note: reopen.note,
      previousResolvedById: reopen.previousResolvedById,
      assigneeId: ticket.assigneeId,
      reopenCount: ticket.reopenCount,
      ...workspace,
    };
    this.eventPublisher.emit('ticket.reopened', reopened);

    // People by name, as the other ticket entries store them: the log reads without lookups
    const label = async (id: string | null) => (id ? await this.describeUser(id) : null);
    await this.createAuditLog.execute({
      action: AuditAction.TICKET_REOPENED,
      category: AuditCategory.TICKET,
      level: AuditLevel.WARNING,
      source: props.apiKeyId ? 'api' : props.byRequester ? 'portal' : 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: {
        ...(props.apiKeyId ? { apiKeyId: props.apiKeyId } : {}),
        ticketName: ticket.name,
        before: { status: previousStatus, assignee: await label(previousAssigneeId) },
        after: { status: ticket.status, assignee: await label(ticket.assigneeId) },
        reason: reopen.reason,
        note: reopen.note,
        previousResolvedBy: await label(reopen.previousResolvedById),
        previousResolvedAt: reopen.previousResolvedAt,
        reopenCount: ticket.reopenCount,
      },
    });

    return {
      id: ticket.getId(),
      status: ticket.status,
      assigneeId: ticket.assigneeId,
      reopenCount: ticket.reopenCount,
      lastReopen: reopen,
    };
  }
}
