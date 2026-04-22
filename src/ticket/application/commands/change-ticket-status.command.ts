import { EventPublisher } from '../../../shared/domain/event-publisher';
import { Command } from '../../../shared/domain/command';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { ChangeTicketStatus } from '../../domain/services/ticket-change-status';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { StatusChangedEvent } from '../../../email/domain/events';

interface Props {
  ticketId: string;
  status: TicketStatus;
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
  ) {}

  async execute(props: Props): Promise<ChangeStatusResponse> {
    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    const permission = ticket.status === 'closed'
      ? PERMISSIONS.TICKET_CHANGE_STATUS_CLOSED
      : PERMISSIONS.TICKET_CHANGE_STATUS;

    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission,
      isSystemAdmin: props.isSystemAdmin,
    });

    const oldStatus = ticket.status;
    const updated = await this.changeStatus.execute({
      ticketId: props.ticketId,
      status: props.status,
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

    return {
      id: updated.getId(),
      status: updated.status,
      resolvedAt: updated.resolvedAt,
    };
  }
}
