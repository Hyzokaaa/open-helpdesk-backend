import { EventPublisher } from '../../../shared/domain/event-publisher';
import { Command } from '../../../shared/domain/command';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { AssignTicket } from '../../domain/services/ticket-assign';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { TicketAssignedEvent } from '../../../email/domain/events';

interface Props {
  ticketId: string;
  assigneeId: string | null;
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
  ) {}

  async execute(props: Props): Promise<AssignTicketResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_ASSIGN,
      isSystemAdmin: props.isSystemAdmin,
    });

    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

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
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
    };
    this.eventPublisher.emit('ticket.assigned', event);

    return {
      id: updated.getId(),
      assigneeId: updated.assigneeId,
    };
  }
}
