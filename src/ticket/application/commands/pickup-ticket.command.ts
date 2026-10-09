import { EventPublisher } from '../../../shared/domain/event-publisher';
import { StatusChangedEvent, TicketAssignedEvent } from '../../../email/domain/events';
import { Command } from '../../../shared/domain/command';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { PickupTicket } from '../../domain/services/ticket-pickup';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  status?: TicketStatus;
  isSystemAdmin: boolean;
  workspaceName?: string;
  workspaceSlug?: string;
}

export interface PickupTicketResponse {
  id: string;
  status: string;
  assigneeId: string | null;
}

export class PickupTicketCommand implements Command<Props, PickupTicketResponse> {
  constructor(
    private readonly pickupTicket: PickupTicket,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly eventPublisher?: EventPublisher,
  ) {}

  async execute(props: Props): Promise<PickupTicketResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_PICKUP,
      isSystemAdmin: props.isSystemAdmin,
    });

    const ticket = await this.pickupTicket.execute({
      ticketId: props.ticketId,
      workspaceId: props.workspaceId,
      userId: props.userId,
      status: props.status,
    });

    // A pickup is a status change and an assignment: it tells people, webhooks and open screens
    // the same way both do on their own. Only open tickets can be picked up, unassigned.
    const statusChanged: StatusChangedEvent = {
      ticketId: ticket.getId(),
      ticketName: ticket.name,
      oldStatus: TicketStatus.OPEN,
      newStatus: ticket.status,
      changedById: props.userId,
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName ?? '',
      workspaceSlug: props.workspaceSlug ?? '',
    };
    this.eventPublisher?.emit('ticket.statusChanged', statusChanged);
    const assigned: TicketAssignedEvent = {
      ticketId: ticket.getId(),
      ticketName: ticket.name,
      newAssigneeId: props.userId,
      previousAssigneeId: null,
      assignedById: props.userId,
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName ?? '',
      workspaceSlug: props.workspaceSlug ?? '',
    };
    this.eventPublisher?.emit('ticket.assigned', assigned);

    await this.createAuditLog.execute({
      action: AuditAction.TICKET_PICKED_UP,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: ticket.getId(),
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { ticketName: ticket.name },
    });

    return { id: ticket.getId(), status: ticket.status, assigneeId: ticket.assigneeId };
  }
}
