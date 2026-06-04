import { EventPublisher } from '../../../shared/domain/event-publisher';
import { Command } from '../../../shared/domain/command';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { AssignTicket } from '../../domain/services/ticket-assign';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { TicketAssignedEvent } from '../../../email/domain/events';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';

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
  ) {}

  async execute(props: Props): Promise<AssignTicketResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_ASSIGN,
      isSystemAdmin: props.isSystemAdmin,
    });

    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Ticket not found');

    const previousAssigneeId = ticket.assigneeId;

    const updated = await this.assignTicket.execute({
      ticketId: props.ticketId,
      assigneeId: props.assigneeId,
    });

    const event: TicketAssignedEvent = {
      ticketId: props.ticketId,
      ticketName: ticket.name,
      newAssigneeId: props.assigneeId,
      previousAssigneeId,
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
    };
    this.eventPublisher.emit('ticket.assigned', event);

    await this.createAuditLog.execute({
      action: AuditAction.TICKET_ASSIGNED,
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { ticketName: ticket.name, before: { assignee: props.previousAssigneeLabel }, after: { assignee: props.assigneeLabel } },
    });

    return {
      id: updated.getId(),
      assigneeId: updated.assigneeId,
    };
  }
}
