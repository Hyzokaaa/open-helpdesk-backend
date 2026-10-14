import { EventPublisher } from '../../../shared/domain/event-publisher';
import { Command } from '../../../shared/domain/command';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { AssignTicket } from '../../domain/services/ticket-assign';
import { EnsureTicketAssignee } from '../../domain/services/ticket-ensure-assignee';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { StatusChangedEvent, TicketAssignedEvent } from '../../../email/domain/events';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  ticketId: string;
  assigneeId: string | null;
  assigneeLabel: string | null;
  previousAssigneeLabel: string | null;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  isSystemAdmin: boolean;
  /** Set when the action came through the public API, with the key that made it. */
  apiKeyId?: string;
}

export interface AssignTicketResponse {
  id: string;
  assigneeId: string | null;
}

export class AssignTicketCommand implements Command<Props, AssignTicketResponse> {
  constructor(
    private readonly assignTicket: AssignTicket,
    private readonly ticketRepository: TicketRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly eventPublisher: EventPublisher,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly ensureAssignee?: EnsureTicketAssignee,
  ) {}

  async execute(props: Props): Promise<AssignTicketResponse> {
    const ticket = await this.ticketRepository.findById(props.ticketId);

    // The assignee may let go of their own ticket; anything else needs ticket.assign
    const releasingOwn = props.assigneeId === null && !!ticket && ticket.assigneeId === props.userId;
    if (!releasingOwn) {
      await this.ensurePermission.execute({
        workspaceId: props.workspaceId,
        userId: props.userId,
        permission: PERMISSIONS.TICKET_ASSIGN,
        isSystemAdmin: props.isSystemAdmin,
      });
    }

    if (!ticket || ticket.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Ticket not found');

    if (props.assigneeId && this.ensureAssignee) {
      await this.ensureAssignee.execute({ workspaceId: props.workspaceId, userId: props.assigneeId });
    }

    const previousAssigneeId = ticket.assigneeId;
    const previousStatus = ticket.status;

    const updated = await this.assignTicket.execute({
      ticketId: props.ticketId,
      assigneeId: props.assigneeId,
    });

    const event: TicketAssignedEvent = {
      ticketId: props.ticketId,
      ticketName: ticket.name,
      newAssigneeId: props.assigneeId,
      previousAssigneeId,
      assignedById: props.userId,
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
    };
    this.eventPublisher.emit('ticket.assigned', event);

    await this.createAuditLog.execute({
      action: AuditAction.TICKET_ASSIGNED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: props.apiKeyId ? 'api' : 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { ...(props.apiKeyId ? { apiKeyId: props.apiKeyId } : {}), ticketName: ticket.name, before: { assignee: props.previousAssigneeLabel }, after: { assignee: props.assigneeLabel } },
    });

    // Assigning an open ticket makes it pending, and leaving one unassigned opens it again
    if (updated.status !== previousStatus) {
      const statusChanged: StatusChangedEvent = {
        ticketId: props.ticketId,
        ticketName: ticket.name,
        oldStatus: previousStatus,
        newStatus: updated.status,
        changedById: props.userId,
        workspaceId: props.workspaceId,
        workspaceName: props.workspaceName,
        workspaceSlug: props.workspaceSlug,
        // The assignment already told people; only webhooks and open screens need this one
        quiet: true,
      };
      this.eventPublisher.emit('ticket.statusChanged', statusChanged);

      await this.createAuditLog.execute({
        action: AuditAction.TICKET_STATUS_CHANGED,
        category: AuditCategory.TICKET,
        level: AuditLevel.INFO,
        source: props.apiKeyId ? 'api' : 'ui',
        entityType: 'ticket',
        entityId: props.ticketId,
        userId: props.userId,
        workspaceId: props.workspaceId,
        metadata: {
          ...(props.apiKeyId ? { apiKeyId: props.apiKeyId } : {}),
          ticketName: ticket.name,
          before: { status: previousStatus },
          after: { status: updated.status },
          reason: props.assigneeId ? 'assigned' : 'unassigned',
        },
      });
    }

    return {
      id: updated.getId(),
      assigneeId: updated.assigneeId,
    };
  }
}
