import { Id } from '../../../shared/domain/id';
import { TicketCategory } from '../enums/ticket-category.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';
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
  createdAt: Date | null;
  deletedAt: Date | null;
  tagIds: string[];
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
  createdAt: Date | null;
  deletedAt: Date | null;
  tagIds: string[];

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
    this.createdAt = props.createdAt;
    this.deletedAt = props.deletedAt;
    this.tagIds = props.tagIds;
  }

  getId(): string {
    return this.id.get();
  }
}
