import { IdGenerator } from '../../../shared/domain/id-generator';
import { Ticket } from '../entities/ticket';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketSource } from '../enums/ticket-source.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { sanitizeHtml } from '../../../shared/domain/sanitize-html';
import { TicketPortalAccess } from '../entities/ticket-portal-access';
import { EnsureTicketPortalAccess } from './ticket-portal-access-ensure';

interface CreateTicketProps {
  name: string;
  description: string;
  priority: TicketPriority;
  categoryId: string;
  workspaceId: string;
  reporterId: string;
  tagIds: string[];
  customFields?: Record<string, unknown>;
  departmentId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  source?: TicketSource;
  registeredById?: string | null;
  mailboxId?: string | null;
  originDate?: Date | null;
}

export interface CreatedTicket {
  ticket: Ticket;
  /** The reporter's portal link: every ticket is born with one, whatever way it came in. */
  reporterAccess: TicketPortalAccess;
}

export class CreateTicket {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: TicketRepository,
    private readonly ensurePortalAccess: EnsureTicketPortalAccess,
  ) {}

  async execute(props: CreateTicketProps): Promise<CreatedTicket> {
    const ticket = new Ticket({
      id: this.idGenerator.create(),
      name: props.name,
      description: sanitizeHtml(props.description),
      priority: props.priority,
      status: TicketStatus.OPEN,
      categoryId: props.categoryId,
      workspaceId: props.workspaceId,
      reporterId: props.reporterId,
      assigneeId: null,
      firstResponseAt: null,
      resolvedAt: null,
      resolvedById: null,
      createdAt: null,
      deletedAt: null,
      tagIds: props.tagIds,
      customFields: props.customFields ?? {},
      discardReason: null,
      departmentId: props.departmentId ?? null,
      organizationId: props.organizationId ?? null,
      projectId: props.projectId ?? null,
      source: props.source,
      registeredById: props.registeredById ?? null,
      mailboxId: props.mailboxId ?? null,
      originDate: props.originDate ?? null,
    });

    await this.repository.create(ticket);
    const reporterAccess = await this.ensurePortalAccess.execute({ ticketId: ticket.getId(), userId: ticket.reporterId });
    return { ticket, reporterAccess };
  }
}
