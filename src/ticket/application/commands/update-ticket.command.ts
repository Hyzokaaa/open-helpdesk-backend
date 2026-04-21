import { Command } from '../../../shared/domain/command';
import { TicketCategory } from '../../domain/enums/ticket-category.enum';
import { TicketPriority } from '../../domain/enums/ticket-priority.enum';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { UpdateTicket } from '../../domain/services/ticket-update';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { EntityNotFoundError } from '../../../shared/domain/errors';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  name?: string;
  description?: string;
  priority?: TicketPriority;
  category?: TicketCategory;
  tagIds?: string[];
}

export interface UpdateTicketResponse {
  id: string;
  name: string;
  priority: string;
  category: string;
}

export class UpdateTicketCommand implements Command<Props, UpdateTicketResponse> {
  constructor(
    private readonly updateTicket: UpdateTicket,
    private readonly ticketRepository: TicketRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<UpdateTicketResponse> {
    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    const isClosed = ticket.status === 'closed';
    const isCreator = ticket.creatorId === props.userId;

    if (isClosed) {
      await this.ensurePermission.execute({
        workspaceId: props.workspaceId,
        userId: props.userId,
        permission: PERMISSIONS.TICKET_EDIT_CLOSED,
        isSystemAdmin: props.isSystemAdmin,
      });
    } else if (!isCreator) {
      await this.ensurePermission.execute({
        workspaceId: props.workspaceId,
        userId: props.userId,
        permission: PERMISSIONS.TICKET_EDIT_DESCRIPTION,
        isSystemAdmin: props.isSystemAdmin,
      });
    }

    const ctx = await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const canEditName = hasPermission(ctx.role, PERMISSIONS.TICKET_EDIT_NAME);

    const updated = await this.updateTicket.execute({
      ticketId: props.ticketId,
      name: canEditName ? props.name : undefined,
      description: props.description,
      priority: props.priority,
      category: props.category,
      tagIds: props.tagIds,
    });

    return {
      id: updated.getId(),
      name: updated.name,
      priority: updated.priority,
      category: updated.category,
    };
  }
}
