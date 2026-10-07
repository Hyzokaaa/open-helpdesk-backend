import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EVENT_LISTENER_METADATA } from '@nestjs/event-emitter/dist/constants';
import { WebhookEvent } from '../../../../webhook/domain/enums/webhook-event.enum';
import { WebhookDeliveryService } from '../../../../webhook/infrastructure/nest/services/webhook-delivery.service';
import { TicketPriority } from '../../../../ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../ticket/domain/enums/ticket-status.enum';
import { NOT_DELIVERED_EXTENSION } from './api-docs.constants';

/*
 * Webhook payloads for the OpenAPI document only. WebhookDeliveryService posts
 * { event, data, timestamp } where `data` is the domain event object exactly as emitted
 * (src/email/domain/events.ts); these classes mirror what the emitters put in it.
 * Keep them in step with the emitters of each event.
 */

const ULID = '01JABCDEF0123456789ABCDEFG';
const WORKSPACE_ULID = '01JWORKSPACE0123456789ABCD';

/** Fields every delivered event carries about its workspace. */
class WebhookWorkspaceFields {
  @ApiProperty({ example: WORKSPACE_ULID })
  workspaceId!: string;

  @ApiProperty({ example: 'Acme Support' })
  workspaceName!: string;

  @ApiProperty({ example: 'acme', description: 'Workspace slug, as in the web app URLs.' })
  workspaceSlug!: string;
}

/** Mirrors TicketCreatedEvent as emitted by CreateTicketCommand, the portal and inbound email. */
export class WebhookTicketCreatedData extends WebhookWorkspaceFields {
  @ApiProperty({ example: ULID })
  ticketId!: string;

  @ApiProperty({ example: 'Cannot log in to the portal', description: 'Ticket title.' })
  ticketName!: string;

  @ApiProperty({ enum: TicketPriority, enumName: 'TicketPriority' })
  priority!: TicketPriority;

  @ApiProperty({ example: ULID, description: 'Category id of the ticket. Empty for an email ticket when no email rule set a category and the workspace has no `issue` category.' })
  categoryId!: string;

  @ApiProperty({ example: ULID, description: 'User who opened the ticket.' })
  reporterId!: string;

  @ApiProperty({ example: 'Ada Lovelace', description: 'Full name of the reporter, or their email when the name is unknown.' })
  reporterName!: string;

  @ApiProperty({
    enum: ['ui', 'email', 'portal'],
    description: '`ui` for tickets created in the web app and through the public API (the event does not tell them apart yet), `email` for inbound email, `portal` for the public portal.',
  })
  source!: 'ui' | 'email' | 'portal';

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'Present on `email` and `portal` tickets only. Opens the public ticket page (/portal/tickets/{portalToken}) without signing in: treat it as a secret.',
  })
  portalToken?: string;

  @ApiPropertyOptional({ example: ULID, description: 'Present on `email` tickets only: the mailbox that received the message.' })
  mailboxId?: string;
}

/** Mirrors StatusChangedEvent as emitted by ChangeTicketStatusCommand. */
export class WebhookTicketStatusChangedData extends WebhookWorkspaceFields {
  @ApiProperty({ example: ULID })
  ticketId!: string;

  @ApiProperty({ example: 'Cannot log in to the portal', description: 'Ticket title.' })
  ticketName!: string;

  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus', description: 'Status before the change.' })
  oldStatus!: TicketStatus;

  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus', description: 'Status after the change.' })
  newStatus!: TicketStatus;

  @ApiProperty({ example: ULID, description: 'User who changed the status.' })
  changedById!: string;
}

/** Mirrors TicketAssignedEvent as emitted by AssignTicketCommand. */
export class WebhookTicketAssignedData extends WebhookWorkspaceFields {
  @ApiProperty({ example: ULID })
  ticketId!: string;

  @ApiProperty({ example: 'Cannot log in to the portal', description: 'Ticket title.' })
  ticketName!: string;

  @ApiProperty({ type: String, nullable: true, example: ULID, description: 'New assignee; null when the ticket was unassigned.' })
  newAssigneeId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Assignee before the change; null when it had none.' })
  previousAssigneeId!: string | null;
}

/** Mirrors NewCommentEvent as emitted by CreateCommentCommand, the portal and inbound email replies. */
export class WebhookCommentCreatedData extends WebhookWorkspaceFields {
  @ApiProperty({ example: ULID })
  ticketId!: string;

  @ApiProperty({ example: 'Cannot log in to the portal', description: 'Ticket title.' })
  ticketName!: string;

  @ApiPropertyOptional({ example: 'TK-000042', description: 'Ticket reference in the workspace format (sequential like TK-000042 or random like TK-7QX4M2K). Opaque: show it, do not parse it. Absent on comments that arrive as email replies.' })
  ticketNumber?: string;

  @ApiProperty({ example: ULID })
  commentId!: string;

  @ApiProperty({ example: ULID, description: 'User who wrote the comment.' })
  authorId!: string;

  @ApiProperty({ example: 'Grace Hopper', description: 'Full name of the author.' })
  authorName!: string;

  @ApiProperty({ example: 'I reset your password, please try again.', description: 'Full text of the comment, as stored.' })
  commentContent!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Assignee of the ticket when the comment was added.' })
  assigneeId!: string | null;

  @ApiProperty({ type: [String], description: 'Users mentioned in the comment. Always empty for portal and email comments.' })
  mentionedUserIds!: string[];

  @ApiProperty({ type: String, nullable: true, description: 'Mailbox of the ticket; null when the ticket did not come from email.' })
  mailboxId!: string | null;
}

/** Mirrors TicketFieldChange. */
export class WebhookTicketFieldChange {
  @ApiProperty({
    enum: ['name', 'description', 'priority', 'categoryId', 'departmentId', 'organizationId', 'projectId', 'tagIds', 'customFields'],
    description: 'The edited field.',
  })
  field!: string;

  @ApiProperty({
    nullable: true,
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }, { type: 'object', additionalProperties: true }],
    description: 'Value before the edit: a string (name, description as sanitized HTML, priority, reference id), null for an empty reference, an array of tag ids for `tagIds`, or the whole custom field map (custom field definition id to value) for `customFields`.',
    example: '01JCATEGORY0123456789ABCDE',
  })
  before!: unknown;

  @ApiProperty({
    nullable: true,
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }, { type: 'object', additionalProperties: true }],
    description: 'Value after the edit, same shape as `before`.', example: '01JCATEGORY9876543210ABCDE' })
  after!: unknown;

  @ApiPropertyOptional({ example: 'Billing', description: 'Name of the `before` reference (category, department, organization, project; tag names joined with ", "). Absent for other fields and when the reference is empty or gone.' })
  beforeLabel?: string;

  @ApiPropertyOptional({ example: 'Technical issue', description: 'Name of the `after` reference, like `beforeLabel`.' })
  afterLabel?: string;
}

/** Mirrors TicketUpdatedEvent as emitted by UpdateTicketCommand. */
export class WebhookTicketUpdatedData extends WebhookWorkspaceFields {
  @ApiProperty({ example: ULID })
  ticketId!: string;

  @ApiProperty({ example: 'TK-000042', description: 'Ticket reference in the workspace format (sequential like TK-000042 or random like TK-7QX4M2K). Opaque: show it, do not parse it.' })
  ticketNumber!: string;

  @ApiProperty({ example: 'Cannot log in to the portal', description: 'Ticket title after the edit.' })
  ticketName!: string;

  @ApiProperty({ example: ULID, description: 'User who edited the ticket (the key creator for API calls).' })
  updatedById!: string;

  @ApiProperty({ type: () => [WebhookTicketFieldChange], description: 'The fields that changed, never empty. Status and assignee changes are separate events.' })
  changes!: WebhookTicketFieldChange[];
}

/** Mirrors TicketDeletedEvent as emitted by DeleteTicketCommand. */
export class WebhookTicketDeletedData extends WebhookWorkspaceFields {
  @ApiProperty({ example: ULID })
  ticketId!: string;

  @ApiProperty({ example: 'TK-000042', description: 'Ticket reference in the workspace format (sequential like TK-000042 or random like TK-7QX4M2K). Opaque: show it, do not parse it.' })
  ticketNumber!: string;

  @ApiProperty({ example: 'Cannot log in to the portal', description: 'Ticket title.' })
  ticketName!: string;

  @ApiProperty({ example: ULID, description: 'User who deleted the ticket (the key creator for API calls).' })
  deletedById!: string;
}

/** Fields shared by every webhook body. */
class WebhookEnvelopeFields {
  @ApiProperty({ type: String, format: 'date-time', description: 'When the request was sent (not when the event happened). Not covered by any header.' })
  timestamp!: string;
}

export class WebhookTicketCreatedPayload extends WebhookEnvelopeFields {
  @ApiProperty({ enum: [WebhookEvent.TICKET_CREATED] })
  event!: string;

  @ApiProperty({ type: () => WebhookTicketCreatedData })
  data!: WebhookTicketCreatedData;
}

export class WebhookTicketStatusChangedPayload extends WebhookEnvelopeFields {
  @ApiProperty({ enum: [WebhookEvent.TICKET_STATUS_CHANGED] })
  event!: string;

  @ApiProperty({ type: () => WebhookTicketStatusChangedData })
  data!: WebhookTicketStatusChangedData;
}

export class WebhookTicketAssignedPayload extends WebhookEnvelopeFields {
  @ApiProperty({ enum: [WebhookEvent.TICKET_ASSIGNED] })
  event!: string;

  @ApiProperty({ type: () => WebhookTicketAssignedData })
  data!: WebhookTicketAssignedData;
}

export class WebhookTicketUpdatedPayload extends WebhookEnvelopeFields {
  @ApiProperty({ enum: [WebhookEvent.TICKET_UPDATED] })
  event!: string;

  @ApiProperty({ type: () => WebhookTicketUpdatedData })
  data!: WebhookTicketUpdatedData;
}

export class WebhookTicketDeletedPayload extends WebhookEnvelopeFields {
  @ApiProperty({ enum: [WebhookEvent.TICKET_DELETED] })
  event!: string;

  @ApiProperty({ type: () => WebhookTicketDeletedData })
  data!: WebhookTicketDeletedData;
}

export class WebhookCommentCreatedPayload extends WebhookEnvelopeFields {
  @ApiProperty({ enum: [WebhookEvent.COMMENT_CREATED] })
  event!: string;

  @ApiProperty({ type: () => WebhookCommentCreatedData })
  data!: WebhookCommentCreatedData;
}

interface WebhookEventDoc {
  summary: string;
  description: string;
  /** Envelope class of the body. */
  payload: Function;
}

/** Description of a selectable event the delivery service does not listen to. */
const NOT_SENT = 'Can be selected on a webhook, but it is not sent yet.';

/** Keyed by the enum, so a new selectable event cannot be left out of the document. */
const WEBHOOK_EVENT_DOCS: Record<WebhookEvent, WebhookEventDoc> = {
  [WebhookEvent.TICKET_CREATED]: {
    summary: 'Ticket created',
    description: 'A ticket was opened: in the web app, through the public API, from the public portal or from an inbound email.',
    payload: WebhookTicketCreatedPayload,
  },
  [WebhookEvent.TICKET_UPDATED]: {
    summary: 'Ticket updated',
    description: 'Fields of a ticket were edited (title, description, priority, category, tags, department, organization, project, custom fields), in the web app or through the public API. Sent only when something changed; status and assignee changes have their own events.',
    payload: WebhookTicketUpdatedPayload,
  },
  [WebhookEvent.TICKET_STATUS_CHANGED]: {
    summary: 'Ticket status changed',
    description: 'A ticket moved to another status, in the web app or through the public API. Note the camelCase event name.',
    payload: WebhookTicketStatusChangedPayload,
  },
  [WebhookEvent.TICKET_ASSIGNED]: {
    summary: 'Ticket assigned',
    description: 'A ticket was assigned, reassigned or unassigned, in the web app or through the public API.',
    payload: WebhookTicketAssignedPayload,
  },
  [WebhookEvent.TICKET_DELETED]: {
    summary: 'Ticket deleted',
    description: 'A ticket was deleted, one by one or in bulk in the web app, or through the public API.',
    payload: WebhookTicketDeletedPayload,
  },
  [WebhookEvent.COMMENT_CREATED]: {
    summary: 'Comment created',
    description: 'A comment was added to a ticket: in the web app, through the public API, from the public portal or as an email reply.',
    payload: WebhookCommentCreatedPayload,
  },
};

export const WEBHOOK_PAYLOAD_MODELS: Function[] = [
  WebhookTicketCreatedPayload,
  WebhookTicketStatusChangedPayload,
  WebhookTicketAssignedPayload,
  WebhookTicketUpdatedPayload,
  WebhookTicketDeletedPayload,
  WebhookCommentCreatedPayload,
];

/** The events WebhookDeliveryService listens to, read from its @OnEvent handlers. */
export function deliveredWebhookEvents(): string[] {
  const proto = WebhookDeliveryService.prototype as unknown as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto).flatMap((key) => {
    const method = proto[key];
    if (typeof method !== 'function') return [];
    const listeners = (Reflect.getMetadata(EVENT_LISTENER_METADATA, method) ?? []) as Array<{ event: string }>;
    return listeners.map((l) => String(l.event));
  });
}

/**
 * x-webhooks: one entry per selectable event, its body schema a component. Events the
 * delivery service does not listen to are flagged x-not-delivered.
 */
export function buildWebhooksExtension(): Record<string, unknown> {
  const delivered = new Set(deliveredWebhookEvents());
  const entries = Object.values(WebhookEvent).map((event) => {
    const doc = WEBHOOK_EVENT_DOCS[event];
    const isDelivered = delivered.has(event);
    const post: Record<string, unknown> = {
      summary: doc.summary,
      description: isDelivered ? doc.description : NOT_SENT,
      operationId: `webhook_${event}`,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: `#/components/schemas/${doc.payload.name}` } } },
      },
      responses: {
        '200': { description: 'Any 2xx status acknowledges the delivery. Other statuses are logged by the server and not retried.' },
      },
    };
    if (!isDelivered) post[NOT_DELIVERED_EXTENSION] = true;
    return [event, { post }] as const;
  });
  return Object.fromEntries(entries);
}

/*
 * Delivery facts, as WebhookDeliveryService implements them. The unit test drives the real
 * service with a stubbed fetch and checks these values against what it sends.
 */
export const WEBHOOK_SIGNATURE_HEADER = 'X-Webhook-Signature';
export const WEBHOOK_EVENT_HEADER = 'X-Webhook-Event';
export const WEBHOOK_TIMEOUT_MS = 10_000;

export function buildWebhookDeliveryExtension(): Record<string, unknown> {
  return {
    method: 'POST',
    contentType: 'application/json',
    body: 'A JSON object { event, data, timestamp }: the event name, the event payload and the ISO 8601 time the request was sent.',
    headers: [
      { name: 'Content-Type', value: 'application/json', description: 'Always JSON.' },
      { name: WEBHOOK_EVENT_HEADER, description: 'The event name, same as `event` in the body.' },
      { name: WEBHOOK_SIGNATURE_HEADER, description: 'HMAC-SHA256 of the raw request body keyed with the webhook secret, hex-encoded, with no prefix.' },
    ],
    signature: {
      header: WEBHOOK_SIGNATURE_HEADER,
      algorithm: 'HMAC-SHA256',
      encoding: 'hex',
      signedContent: 'The raw request body, byte for byte. No header or timestamp is signed separately.',
      key: 'The webhook secret: the one set when creating the webhook, or 64 hex characters generated by the server when left empty.',
    },
    timeoutMs: WEBHOOK_TIMEOUT_MS,
    attempts: 1,
    retries: 0,
    successStatus: '2xx',
    failure: 'A non-2xx status, a network error or the timeout is logged on the server and the delivery is dropped. There are no retries and no delivery log.',
    redirects: 'followed',
    ordering: 'Each webhook subscribed to the event gets its own request, sent without waiting for the others. There is no ordering guarantee between events.',
    subscription: 'Only active webhooks of the workspace where the event happened that selected the event receive it.',
  };
}
