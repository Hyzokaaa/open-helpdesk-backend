import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { Ticket } from '../entities/ticket';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketStatus } from '../enums/ticket-status.enum';

export interface TicketFilters {
  search?: string;
  /**
   * The search term already read as a ticket reference with the workspace's format: the counter
   * it points to, or null when it is not a reference. Left out, the default format reads it.
   */
  ticketNumber?: number | null;
  /** Spellings of the term as a stored reference (with and without the workspace prefix). */
  referenceCandidates?: string[];
  /** Tickets in any of these statuses. */
  statuses?: TicketStatus[];
  excludeStatus?: string;
  priorities?: TicketPriority[];
  /** Tickets with any of these tags. */
  tagIds?: string[];
  /** In these lists, null stands for "has none". */
  departmentIds?: (string | null)[];
  /** Also the tickets of the departments this user is an agent of ("My departments"). */
  departmentsOfUserId?: string;
  organizationIds?: (string | null)[];
  projectId?: string;
  categoryIds?: (string | null)[];
  /** Only the tickets reopened at least once. */
  reopened?: boolean;
  assigneeId?: string;
  reporterId?: string;
  registeredById?: string;
  agentUserId?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface TicketRepository {
  create(ticket: Ticket): Promise<void>;
  findById(id: string): Promise<Ticket | null>;
  findAll(
    workspaceId: string,
    filters: TicketFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Ticket>>;
  update(ticket: Ticket): Promise<void>;
  softDelete(id: string): Promise<void>;
  countByWorkspaceIdSince(workspaceId: string, since: Date): Promise<number>;
  /** The ticket of a workspace with this reference as stored (TK-000042), or null. */
  findByReference(workspaceId: string, reference: string): Promise<Ticket | null>;
}
