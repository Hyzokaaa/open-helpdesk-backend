import { Query } from '../../../shared/domain/query';
import { PaginatedResult } from '../../../shared/domain/paginated-result';
import {
  TicketFilters,
  TicketRepository,
} from '../../domain/repositories/ticket.repository';

interface Props {
  workspaceId: string;
  filters: TicketFilters;
  page: number;
  limit: number;
}

export interface TicketListItem {
  id: string;
  name: string;
  priority: string;
  status: string;
  category: string;
  creatorId: string;
  assigneeId: string | null;
  createdAt: Date | null;
  tagIds: string[];
}

export class ListTicketsQuery
  implements Query<Props, PaginatedResult<TicketListItem>>
{
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: Props): Promise<PaginatedResult<TicketListItem>> {
    const result = await this.repository.findAll(
      props.workspaceId,
      props.filters,
      props.page,
      props.limit,
    );

    return {
      items: result.items.map((ticket) => ({
        id: ticket.getId(),
        name: ticket.name,
        priority: ticket.priority,
        status: ticket.status,
        category: ticket.category,
        creatorId: ticket.creatorId,
        assigneeId: ticket.assigneeId,
        createdAt: ticket.createdAt,
        tagIds: ticket.tagIds,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
