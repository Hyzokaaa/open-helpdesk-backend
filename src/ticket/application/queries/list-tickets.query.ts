import { Query } from '../../../shared/domain/query';
import { PaginatedResult } from '../../../shared/domain/paginated-result';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import {
  TicketFilters,
  TicketRepository,
} from '../../domain/repositories/ticket.repository';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  filters: TicketFilters;
  page: number;
  limit: number;
}

export interface TicketListItem {
  id: string;
  name: string;
  priority: string;
  status: string;
  categoryId: string | null;
  projectId: string | null;
  reporterId: string;
  assigneeId: string | null;
  ticketNumber: number;
  createdAt: Date | null;
  tagIds: string[];
  customFields: Record<string, unknown>;
  departmentId: string | null;
  organizationId: string | null;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
}

export class ListTicketsQuery
  implements Query<Props, PaginatedResult<TicketListItem>>
{
  constructor(
    private readonly repository: TicketRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<PaginatedResult<TicketListItem>> {
    const ctx = await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      anyOf: [PERMISSIONS.TICKET_VIEW, PERMISSIONS.TICKET_VIEW_OWN],
      isSystemAdmin: props.isSystemAdmin,
    });

    const filters = { ...props.filters };
    if (!hasPermission(ctx.role, PERMISSIONS.TICKET_VIEW)) {
      if (hasPermission(ctx.role, PERMISSIONS.TICKET_CREATE) && ctx.role !== WorkspaceRole.USER) {
        filters.agentUserId = props.userId;
      } else {
        filters.reporterId = props.userId;
      }
    }

    const result = await this.repository.findAll(
      props.workspaceId,
      filters,
      props.page,
      props.limit,
    );

    return {
      items: result.items.map((ticket) => ({
        id: ticket.getId(),
        name: ticket.name,
        priority: ticket.priority,
        status: ticket.status,
        categoryId: ticket.categoryId,
        projectId: ticket.projectId,
        reporterId: ticket.reporterId,
        assigneeId: ticket.assigneeId,
        ticketNumber: ticket.ticketNumber,
        createdAt: ticket.createdAt,
        tagIds: ticket.tagIds,
        customFields: ticket.customFields,
        departmentId: ticket.departmentId,
        organizationId: ticket.organizationId,
        firstResponseBreached: ticket.firstResponseBreached,
        resolutionBreached: ticket.resolutionBreached,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
