import { EventPublisher } from '../../../shared/domain/event-publisher';
import { Command } from '../../../shared/domain/command';
import { TicketCategory } from '../../domain/enums/ticket-category.enum';
import { TicketPriority } from '../../domain/enums/ticket-priority.enum';
import { CreateTicket } from '../../domain/services/ticket-create';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { TicketCreatedEvent } from '../../../email/domain/events';

interface Props {
  name: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  userEmail: string;
  tagIds: string[];
  isSystemAdmin: boolean;
}

export interface CreateTicketResponse {
  id: string;
  name: string;
  status: string;
}

export class CreateTicketCommand implements Command<Props, CreateTicketResponse> {
  constructor(
    private readonly createTicket: CreateTicket,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly userRepository: UserRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(props: Props): Promise<CreateTicketResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_CREATE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const ticket = await this.createTicket.execute({
      name: props.name,
      description: props.description,
      priority: props.priority,
      category: props.category,
      workspaceId: props.workspaceId,
      creatorId: props.userId,
      tagIds: props.tagIds,
    });

    const creator = await this.userRepository.findById(props.userId);
    const event: TicketCreatedEvent = {
      ticketId: ticket.getId(),
      ticketName: props.name,
      priority: props.priority,
      category: props.category,
      creatorId: props.userId,
      creatorName: creator ? `${creator.firstName} ${creator.lastName}` : props.userEmail,
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
    };
    this.eventPublisher.emit('ticket.created', event);

    return {
      id: ticket.getId(),
      name: ticket.name,
      status: ticket.status,
    };
  }
}
