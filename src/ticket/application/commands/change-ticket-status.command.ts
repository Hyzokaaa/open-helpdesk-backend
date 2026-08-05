import { EventPublisher } from '../../../shared/domain/event-publisher';
import { Command } from '../../../shared/domain/command';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketDiscardReason } from '../../domain/enums/ticket-discard-reason.enum';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { ChangeTicketStatus } from '../../domain/services/ticket-change-status';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { StatusChangedEvent } from '../../../email/domain/events';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  ticketId: string;
  status: TicketStatus;
  discardReason?: TicketDiscardReason;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface ChangeStatusResponse {
  id: string;
  status: string;
  resolvedAt: Date | null;
}

export class ChangeTicketStatusCommand implements Command<Props, ChangeStatusResponse> {
  constructor(
    private readonly changeStatus: ChangeTicketStatus,
    private readonly ticketRepository: TicketRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly eventPublisher: EventPublisher,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<ChangeStatusResponse> {
    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Ticket not found');

    const permission = ticket.status === 'discarded'
      ? PERMISSIONS.TICKET_CHANGE_STATUS_DISCARDED
      : PERMISSIONS.TICKET_CHANGE_STATUS;

    const ctx = await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission,
      isSystemAdmin: props.isSystemAdmin,
    });

    const canMoveToOpen = ctx.role === WorkspaceRole.ADMIN || ctx.role === WorkspaceRole.SUPERVISOR;

    const oldStatus = ticket.status;
    const updated = await this.changeStatus.execute({
      ticketId: props.ticketId,
      status: props.status,
      discardReason: props.discardReason,
      userId: props.userId,
      canMoveToOpen,
    });

    const event: StatusChangedEvent = {
      ticketId: props.ticketId,
      ticketName: ticket.name,
      oldStatus,
      newStatus: props.status,
      changedById: props.userId,
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
    };
    this.eventPublisher.emit('ticket.statusChanged', event);

    await this.createAuditLog.execute({
      action: AuditAction.TICKET_STATUS_CHANGED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { ticketName: ticket.name, before: { status: oldStatus }, after: { status: props.status } },
    });

    return {
      id: updated.getId(),
      status: updated.status,
      resolvedAt: updated.resolvedAt,
    };
  }
}
