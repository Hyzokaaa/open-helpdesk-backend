import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { EnsureTicketAccess, TicketAccessLevel } from '../../domain/services/ticket-ensure-access';

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
  reporterId: string;
  source: string;
  registeredById: string | null;
  assigneeId: string | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  ticketNumber: number;
  createdAt: Date | null;
  originDate: Date | null;
  tagIds: string[];
  customFields: Record<string, unknown>;
  discardReason: string | null;
  departmentId: string | null;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  accessLevel: TicketAccessLevel;
  aiCache: Record<string, { source: string; result: string }>;
}

export class GetTicketQuery implements Query<Props, TicketDetailResponse> {
  constructor(
    private readonly repository: TicketRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
  ) {}

  async execute(props: Props): Promise<TicketDetailResponse> {
    const accessLevel = await this.ensureTicketAccess.execute(props);

    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Ticket not found');
    }

    return {
      id: ticket.getId(),
      name: ticket.name,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      category: ticket.categoryId,
      workspaceId: ticket.workspaceId,
      reporterId: ticket.reporterId,
      source: ticket.source,
      registeredById: ticket.registeredById,
      assigneeId: ticket.assigneeId,
      firstResponseAt: ticket.firstResponseAt,
      resolvedAt: ticket.resolvedAt,
      ticketNumber: ticket.ticketNumber,
      createdAt: ticket.createdAt,
      originDate: ticket.originDate,
      tagIds: ticket.tagIds,
      customFields: ticket.customFields,
      discardReason: ticket.discardReason,
      departmentId: ticket.departmentId,
      firstResponseBreached: ticket.firstResponseBreached,
      resolutionBreached: ticket.resolutionBreached,
      accessLevel,
      aiCache: ticket.aiCache ?? {},
    };
  }
}
