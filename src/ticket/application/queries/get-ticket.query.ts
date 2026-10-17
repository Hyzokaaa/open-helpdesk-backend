import { EmailQuoteRepository } from '../../domain/repositories/email-quote.repository';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { EnsureTicketAccess, TicketAccessLevel } from '../../domain/services/ticket-ensure-access';
import { ticketReferenceOf } from '../../domain/ticket-reference';
import { SummarizeUsers, UserSummary } from '../../../user/domain/services/user-summarize';
import { AuditActivityRepository } from '../../../audit-log/domain/repositories/audit-activity.repository';

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
  /** When a person last did anything to the ticket: a change, a comment, a file, an edit... */
  lastActivityAt?: Date | null;
  /** Lines of quoted text folded under the description (the opening email's signature). */
  descriptionQuotedLines?: number;
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
    private readonly activity?: AuditActivityRepository,
    private readonly emailQuotes?: EmailQuoteRepository,
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

    // Its creation counts too, so a ticket always has one, also once retention removed its entries
    const lastActivityAt = this.activity
      ? latest(await this.activity.findLastActivityAt(props.workspaceId, 'ticket', ticket.getId()), ticket.createdAt)
      : undefined;

    const descriptionQuote = this.emailQuotes
      ? (await this.emailQuotes.findSummariesByTicketId(ticket.getId())).find((q) => q.commentId === null)
      : undefined;

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
      ticketNumber: ticketReferenceOf(ticket),
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
      ...(lastActivityAt !== undefined && { lastActivityAt }),
      ...(descriptionQuote && { descriptionQuotedLines: descriptionQuote.lineCount }),
      ...(people && {
        reporter: person(ticket.reporterId),
        assignee: person(ticket.assigneeId),
        registeredBy: person(ticket.registeredById),
        resolvedBy: person(ticket.resolvedById),
      }),
    };
  }
}

function latest(...dates: (Date | null)[]): Date | null {
  const times = dates.filter((d): d is Date => d !== null).map((d) => d.getTime());
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}
