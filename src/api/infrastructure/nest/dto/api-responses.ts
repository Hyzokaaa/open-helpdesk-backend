import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '../../../../ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../ticket/domain/enums/ticket-status.enum';
import { TicketSource } from '../../../../ticket/domain/enums/ticket-source.enum';
import { TicketDiscardReason } from '../../../../ticket/domain/enums/ticket-discard-reason.enum';
import { WorkspaceRole } from '../../../../workspace/domain/enums/workspace-role.enum';

/*
 * Schemas for the OpenAPI document only. The handlers return the DTOs of their use cases;
 * these classes mirror those shapes field by field so the document can describe them.
 * Keep them in step with the use case responses they name.
 */

const ULID = '01JABCDEF0123456789ABCDEFG';

/** Mirrors TicketListItem (list-tickets.query.ts). */
export class ApiTicketListItem {
  @ApiProperty({ example: ULID })
  id!: string;

  @ApiProperty({ example: 'Cannot log in to the portal' })
  name!: string;

  @ApiProperty({ enum: TicketPriority, enumName: 'TicketPriority' })
  priority!: TicketPriority;

  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  status!: TicketStatus;

  @ApiProperty({ type: String, nullable: true })
  categoryId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  projectId!: string | null;

  @ApiProperty({ description: 'User who opened the ticket.' })
  reporterId!: string;

  @ApiProperty({ type: String, nullable: true })
  assigneeId!: string | null;

  @ApiProperty({ example: 'TK-000042', description: 'Ticket reference, unique per workspace, in its format (sequential like TK-000042 or random like TK-7QX4M2K). Opaque: show it, do not parse it.' })
  ticketNumber!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;

  @ApiProperty({ type: [String] })
  tagIds!: string[];

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Custom field values keyed by field definition id.' })
  customFields!: Record<string, unknown>;

  @ApiProperty({ type: String, nullable: true })
  departmentId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  organizationId!: string | null;

  @ApiProperty()
  firstResponseBreached!: boolean;

  @ApiProperty()
  resolutionBreached!: boolean;
}

export class ApiTicketPage {
  @ApiProperty({ type: [ApiTicketListItem] })
  items!: ApiTicketListItem[];

  @ApiProperty({ example: 57, description: 'Total matching tickets across all pages.' })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}

class ApiAiCacheEntry {
  @ApiProperty()
  source!: string;

  @ApiProperty()
  result!: string;
}

/** Mirrors TicketDetailResponse (get-ticket.query.ts) as the public API returns it, without user summaries. */
export class ApiTicketDetail {
  @ApiProperty({ example: ULID })
  id!: string;

  @ApiProperty({ example: 'Cannot log in to the portal' })
  name!: string;

  @ApiProperty({ description: 'HTML body of the ticket.' })
  description!: string;

  @ApiProperty({ enum: TicketPriority, enumName: 'TicketPriority' })
  priority!: TicketPriority;

  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  status!: TicketStatus;

  @ApiProperty({ type: String, nullable: true })
  categoryId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  projectId!: string | null;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({ description: 'User who opened the ticket.' })
  reporterId!: string;

  @ApiProperty({ enum: TicketSource, enumName: 'TicketSource' })
  source!: TicketSource;

  @ApiProperty({ type: String, nullable: true, description: 'User who registered the ticket on behalf of the reporter.' })
  registeredById!: string | null;

  @ApiProperty({ type: String, nullable: true })
  assigneeId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  firstResponseAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  resolvedById!: string | null;

  @ApiProperty({ example: 'TK-000042', description: 'Ticket reference in the workspace format. Opaque: show it, do not parse it.' })
  ticketNumber!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  originDate!: string | null;

  @ApiProperty({ type: [String] })
  tagIds!: string[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  customFields!: Record<string, unknown>;

  @ApiProperty({ enum: TicketDiscardReason, enumName: 'TicketDiscardReason', nullable: true })
  discardReason!: TicketDiscardReason | null;

  @ApiProperty({ type: String, nullable: true })
  departmentId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  organizationId!: string | null;

  @ApiProperty()
  firstResponseBreached!: boolean;

  @ApiProperty()
  resolutionBreached!: boolean;

  @ApiProperty({ enum: ['full', 'readonly'], description: 'What the key creator may do with this ticket.' })
  accessLevel!: 'full' | 'readonly';

  @ApiProperty({ type: 'object', additionalProperties: { $ref: '#/components/schemas/ApiAiCacheEntry' } })
  aiCache!: Record<string, ApiAiCacheEntry>;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  descriptionEditedAt!: string | null;
}

/** Mirrors CreateTicketResponse (create-ticket.command.ts). */
export class ApiCreatedTicket {
  @ApiProperty({ example: ULID })
  id!: string;

  @ApiProperty({ example: 'Cannot log in to the portal' })
  name!: string;

  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus', example: TicketStatus.OPEN })
  status!: TicketStatus;
}

/**
 * PATCH /tickets/:id returns UpdateTicketResponse when a field other than status or assignee
 * changed, and only the id otherwise; the optional fields cover both.
 */
export class ApiUpdatedTicket {
  @ApiProperty({ example: ULID })
  id!: string;

  @ApiPropertyOptional({ description: 'Present when name, description, priority, category, tags or custom fields were sent.' })
  name?: string;

  @ApiPropertyOptional({ enum: TicketPriority, enumName: 'TicketPriority', description: 'Present when name, description, priority, category, tags or custom fields were sent.' })
  priority?: TicketPriority;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Present when name, description, priority, category, tags or custom fields were sent.' })
  categoryId?: string | null;
}

/** Mirrors CommentListItem (list-ticket-comments.query.ts) as the public API returns it, without author summaries. */
export class ApiComment {
  @ApiProperty({ example: ULID })
  id!: string;

  @ApiProperty({ description: 'HTML body of the comment.' })
  content!: string;

  @ApiProperty()
  authorId!: string;

  @ApiProperty({ type: [String] })
  mentionedUserIds!: string[];

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  editedAt!: string | null;
}

export class ApiCommentPage {
  @ApiProperty({ type: [ApiComment] })
  items!: ApiComment[];

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}

/** Mirrors CreateCommentResponse (create-comment.command.ts). */
export class ApiCreatedComment {
  @ApiProperty({ example: ULID })
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  ticketId!: string;

  @ApiProperty()
  authorId!: string;
}

/** Mirrors the object GET /members builds in the controller. */
export class ApiMember {
  @ApiProperty({ description: 'Membership id.' })
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jane' })
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  role!: WorkspaceRole;
}

class ApiExchangedUser {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;
}

/** Mirrors ExchangeTokenResponse (exchange-token.command.ts). */
export class ApiExchangedToken {
  @ApiProperty({ description: 'Signed-in session token for the user (JWT). No refresh token is issued.' })
  accessToken!: string;

  @ApiProperty({ type: ApiExchangedUser })
  user!: ApiExchangedUser;
}

/** Body of every error response. */
export class ApiErrorBody {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Ticket not found',
    description: 'A sentence, or a list of sentences for validation errors.',
  })
  message!: string | string[];

  @ApiPropertyOptional({ example: 'EntityNotFoundError' })
  error?: string;
}

export const API_RESPONSE_EXTRA_MODELS = [ApiAiCacheEntry];
