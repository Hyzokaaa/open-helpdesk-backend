import { Id } from '../../../shared/domain/id';
import { TicketCategory } from '../enums/ticket-category.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketDiscardReason } from '../enums/ticket-discard-reason.enum';
import { TicketStatus } from '../enums/ticket-status.enum';

interface Props {
  id: string;
  name: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  workspaceId: string;
  creatorId: string;
  assigneeId: string | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdAt: Date | null;
  deletedAt: Date | null;
  ticketNumber?: number;
  tagIds: string[];
  customFields: Record<string, unknown>;
  discardReason: TicketDiscardReason | null;
}

export class Ticket {
  readonly id: Id;
  name: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  workspaceId: string;
  creatorId: string;
  assigneeId: string | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdAt: Date | null;
  deletedAt: Date | null;
  ticketNumber: number;
  tagIds: string[];
  customFields: Record<string, unknown>;
  discardReason: TicketDiscardReason | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.description = props.description;
    this.priority = props.priority;
    this.status = props.status;
    this.category = props.category;
    this.workspaceId = props.workspaceId;
    this.creatorId = props.creatorId;
    this.assigneeId = props.assigneeId;
    this.resolvedAt = props.resolvedAt;
    this.resolvedById = props.resolvedById ?? null;
    this.createdAt = props.createdAt;
    this.deletedAt = props.deletedAt;
    this.ticketNumber = props.ticketNumber ?? 0;
    this.tagIds = props.tagIds;
    this.customFields = props.customFields ?? {};
    this.discardReason = props.discardReason ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
