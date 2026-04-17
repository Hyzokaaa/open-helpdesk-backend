import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { Ticket } from '../entities/ticket';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketStatus } from '../enums/ticket-status.enum';

export interface TicketFilters {
  status?: TicketStatus;
  excludeStatus?: TicketStatus;
  priority?: TicketPriority;
  tagIds?: string[];
  assigneeId?: string;
  creatorId?: string;
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
}
