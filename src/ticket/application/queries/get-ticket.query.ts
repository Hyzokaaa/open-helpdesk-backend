import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { TicketRepository } from '../../domain/repositories/ticket.repository';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface TicketDetailResponse {
  id: string;
  name: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  workspaceId: string;
  creatorId: string;
  assigneeId: string | null;
  resolvedAt: Date | null;
  tagIds: string[];
  customFields: Record<string, unknown>;
}

export class GetTicketQuery implements Query<Props, TicketDetailResponse> {
  constructor(
    private readonly repository: TicketRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<TicketDetailResponse> {
    const ctx = await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      anyOf: [PERMISSIONS.TICKET_VIEW, PERMISSIONS.TICKET_VIEW_OWN],
      isSystemAdmin: props.isSystemAdmin,
    });

    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new EntityNotFoundError('Ticket not found');
    }

    if (!hasPermission(ctx.role, PERMISSIONS.TICKET_VIEW) && ticket.creatorId !== props.userId) {
      throw new AccessDeniedError('You can only view your own tickets');
    }

    return {
      id: ticket.getId(),
      name: ticket.name,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      category: ticket.category,
      workspaceId: ticket.workspaceId,
      creatorId: ticket.creatorId,
      assigneeId: ticket.assigneeId,
      resolvedAt: ticket.resolvedAt,
      tagIds: ticket.tagIds,
      customFields: ticket.customFields,
    };
  }
}
