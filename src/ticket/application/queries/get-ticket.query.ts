import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { EnsureTicketAccess, TicketAccessLevel } from '../../domain/services/ticket-ensure-access';
import { formatTicketNumber } from '../../domain/ticket-number';
import { TicketReferenceFormats } from '../../domain/services/ticket-reference-formats';
import { SummarizeUsers, UserSummary } from '../../../user/domain/services/user-summarize';

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
  categoryId: string | null;
  projectId: string | null;
  workspaceId: string;
  reporterId: string;
  source: string;
  registeredById: string | null;
  assigneeId: string | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  ticketNumber: string;
  createdAt: Date | null;
  originDate: Date | null;
  tagIds: string[];
  customFields: Record<string, unknown>;
  discardReason: string | null;
  departmentId: string | null;
  organizationId: string | null;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  accessLevel: TicketAccessLevel;
  aiCache: Record<string, { source: string; result: string }>;
  descriptionEditedAt: Date | null;
  reporter?: UserSummary | null;
  assignee?: UserSummary | null;
  registeredBy?: UserSummary | null;
  resolvedBy?: UserSummary | null;
}

export class GetTicketQuery implements Query<Props, TicketDetailResponse> {
  constructor(
    private readonly repository: TicketRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly summarizeUsers?: SummarizeUsers,
    private readonly referenceFormats?: TicketReferenceFormats,
  ) {}

  async execute(props: Props): Promise<TicketDetailResponse> {
    const accessLevel = await this.ensureTicketAccess.execute(props);

    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Ticket not found');
    }

    const people = this.summarizeUsers
      ? await this.summarizeUsers.execute([ticket.reporterId, ticket.assigneeId, ticket.registeredById, ticket.resolvedById])
      : null;
    const person = (id: string | null) => (id ? people?.get(id) ?? null : null);

    return {
      id: ticket.getId(),
      name: ticket.name,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      categoryId: ticket.categoryId,
      projectId: ticket.projectId,
      workspaceId: ticket.workspaceId,
      reporterId: ticket.reporterId,
      source: ticket.source,
      registeredById: ticket.registeredById,
      assigneeId: ticket.assigneeId,
      firstResponseAt: ticket.firstResponseAt,
      resolvedAt: ticket.resolvedAt,
      resolvedById: ticket.resolvedById,
      ticketNumber: this.referenceFormats
        ? await this.referenceFormats.format(ticket.workspaceId, ticket.ticketNumber)
        : formatTicketNumber(ticket.ticketNumber),
      createdAt: ticket.createdAt,
      originDate: ticket.originDate,
      tagIds: ticket.tagIds,
      customFields: ticket.customFields,
      discardReason: ticket.discardReason,
      departmentId: ticket.departmentId,
      organizationId: ticket.organizationId,
      firstResponseBreached: ticket.firstResponseBreached,
      resolutionBreached: ticket.resolutionBreached,
      accessLevel,
      aiCache: ticket.aiCache ?? {},
      descriptionEditedAt: ticket.descriptionEditedAt,
      ...(people && {
        reporter: person(ticket.reporterId),
        assignee: person(ticket.assigneeId),
        registeredBy: person(ticket.registeredById),
        resolvedBy: person(ticket.resolvedById),
      }),
    };
  }
}
