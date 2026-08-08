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
  reporterId: string;
  assigneeId: string | null;
  firstResponseAt?: Date | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdAt: Date | null;
  deletedAt: Date | null;
  ticketNumber?: number;
  tagIds: string[];
  customFields: Record<string, unknown>;
  discardReason: TicketDiscardReason | null;
  portalToken?: string | null;
  firstResponseBreached?: boolean;
  resolutionBreached?: boolean;
  aiCache?: Record<string, { source: string; result: string }>;
  registeredById?: string | null;
  mailboxId?: string | null;
}

export class Ticket {
  readonly id: Id;
  name: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  workspaceId: string;
  reporterId: string;
  assigneeId: string | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdAt: Date | null;
  deletedAt: Date | null;
  ticketNumber: number;
  tagIds: string[];
  customFields: Record<string, unknown>;
  discardReason: TicketDiscardReason | null;
  portalToken: string | null;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  aiCache: Record<string, { source: string; result: string }>;
  registeredById: string | null;
  mailboxId: string | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.description = props.description;
    this.priority = props.priority;
    this.status = props.status;
    this.category = props.category;
    this.workspaceId = props.workspaceId;
    this.reporterId = props.reporterId;
    this.assigneeId = props.assigneeId;
    this.firstResponseAt = props.firstResponseAt ?? null;
    this.resolvedAt = props.resolvedAt;
    this.resolvedById = props.resolvedById ?? null;
    this.createdAt = props.createdAt;
    this.deletedAt = props.deletedAt;
    this.ticketNumber = props.ticketNumber ?? 0;
    this.tagIds = props.tagIds;
    this.customFields = props.customFields ?? {};
    this.discardReason = props.discardReason ?? null;
    this.portalToken = props.portalToken ?? null;
    this.firstResponseBreached = props.firstResponseBreached ?? false;
    this.resolutionBreached = props.resolutionBreached ?? false;
    this.aiCache = props.aiCache ?? {};
    this.registeredById = props.registeredById ?? null;
    this.mailboxId = props.mailboxId ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
