import { ApiKeyScope } from '../../../../api-key/domain/enums/api-key-scope.enum';
import { WebhookEvent } from '../../../../webhook/domain/enums/webhook-event.enum';

/** What each scope allows, keyed by the scope so a new scope cannot be left out of the table. */
const SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  [ApiKeyScope.TICKETS_READ]: 'List tickets and read a ticket.',
  [ApiKeyScope.TICKETS_WRITE]: 'Create, update (fields, status, assignee) and delete tickets.',
  [ApiKeyScope.COMMENTS_READ]: 'List the comments of a ticket.',
  [ApiKeyScope.COMMENTS_WRITE]: 'Add comments to a ticket.',
  [ApiKeyScope.MEMBERS_READ]: 'List the members of the workspace.',
  [ApiKeyScope.AUTH_EXCHANGE]: 'Create users and agents of the workspace and sign them in (delegated sign-in).',
  [ApiKeyScope.AUTH_EXCHANGE_ADMIN]: 'With `auth:exchange`: also create and sign in supervisors and admins of the workspace. Never granted by default.',
};

/** Webhook events the server delivers today. The others can be selected on a webhook but are not sent yet. */
const DELIVERED_WEBHOOK_EVENTS: WebhookEvent[] = [
  WebhookEvent.TICKET_CREATED,
  WebhookEvent.TICKET_STATUS_CHANGED,
  WebhookEvent.TICKET_ASSIGNED,
  WebhookEvent.COMMENT_CREATED,
];

const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEvent, string> = {
  [WebhookEvent.TICKET_CREATED]: 'A ticket was opened, from any source.',
  [WebhookEvent.TICKET_UPDATED]: 'Selectable, not delivered yet.',
  [WebhookEvent.TICKET_STATUS_CHANGED]: 'A ticket moved to another status. Note the camelCase name.',
  [WebhookEvent.TICKET_ASSIGNED]: 'A ticket was assigned, reassigned or unassigned.',
  [WebhookEvent.TICKET_DELETED]: 'Selectable, not delivered yet.',
  [WebhookEvent.COMMENT_CREATED]: 'A comment was added to a ticket.',
};

export const RATE_LIMIT = { limit: 100, ttlSeconds: 60 };

export function buildApiGuide(): string {
  const scopeRows = (Object.keys(SCOPE_DESCRIPTIONS) as ApiKeyScope[])
    .map((scope) => `| \`${scope}\` | ${SCOPE_DESCRIPTIONS[scope]} |`)
    .join('\n');

  const eventRows = (Object.values(WebhookEvent) as WebhookEvent[])
    .map((event) => `| \`${event}\` | ${DELIVERED_WEBHOOK_EVENTS.includes(event) ? 'yes' : 'no'} | ${WEBHOOK_EVENT_DESCRIPTIONS[event]} |`)
    .join('\n');

  return `
The public REST API of Open Helpdesk, for integrations that read and write the tickets of one workspace.

## Authentication

1. In the web app, open the workspace **Settings → API Keys** (it needs permission to manage the workspace settings) and create a key. Choose its scopes and, optionally, an expiry date. The key (\`ohd_...\`) is shown once; store it as a secret.
2. Send it on every request as a bearer token:

\`\`\`
Authorization: Bearer ohd_your_key
\`\`\`

- A key belongs to the workspace it was created in. Every request acts on that workspace only; there is no workspace slug in the URL.
- A key acts with the **workspace role of the user who created it**. Scopes narrow what the key can call, and the creator's role still decides what it may do: a key created by an agent cannot delete tickets even with \`tickets:write\`.
- A key stops working when it expires or when its creator is deactivated.
- Keys are only accepted on \`/api/v1\`. Sent to any other endpoint they are refused with \`401\`.

## Scopes

Each operation states the scope it requires. A key created without choosing scopes gets every scope except \`auth:exchange:admin\`.

| Scope | Allows |
|---|---|
${scopeRows}

## Rate limiting

Each endpoint allows **${RATE_LIMIT.limit} requests per ${RATE_LIMIT.ttlSeconds} seconds per client IP address**. The counter is kept per endpoint (listing tickets and creating a ticket count separately) and in the memory of the server process.

Every response carries \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` and \`X-RateLimit-Reset\` (seconds until the window resets). Past the limit the API answers \`429\` with a \`Retry-After\` header in seconds.

If the server runs behind a reverse proxy, the address it sees may be the proxy's, in which case all clients behind it share one counter.

## Errors

Errors are JSON with the HTTP status repeated in \`statusCode\`, a human-readable \`message\` and, usually, an \`error\` label:

\`\`\`json
{ "statusCode": 404, "message": "Ticket not found", "error": "EntityNotFoundError" }
\`\`\`

Request validation failures return \`400\` with \`message\` as a list:

\`\`\`json
{
  "statusCode": 400,
  "message": ["name must be longer than or equal to 3 characters", "priority must be one of the following values: low, medium, high, critical"],
  "error": "Bad Request"
}
\`\`\`

| Status | When |
|---|---|
| \`400\` | The body or query failed validation, or a business rule rejected the change (\`error: "DomainValidationError"\`), such as a status transition the workflow does not allow. Unknown body properties are ignored, not rejected. |
| \`401\` | No \`Authorization\` header, the key expired, or its creator is deactivated. |
| \`403\` | The key is unknown or revoked (\`"Forbidden resource"\`), it lacks the operation's scope (\`"Insufficient API key permissions"\`), or the creator's role does not allow the action (\`error: "AccessDeniedError"\`). |
| \`404\` | The ticket does not exist in the key's workspace. Tickets of other workspaces are reported as not found. |
| \`429\` | Rate limit exceeded (\`"ThrottlerException: Too Many Requests"\`). |

## Ticket numbers

Every ticket has a ULID \`id\`, used in URLs, and a \`ticketNumber\` shown to people, formatted as \`TK-000042\`: the prefix \`TK-\` and a counter of at least six digits, unique and gap-free within the workspace. Past 999999 it grows to more digits (\`TK-1000000\`) instead of wrapping, so do not parse it as fixed width.

The \`search\` filter of \`GET /tickets\` accepts a ticket number in any of the forms \`TK-000042\`, \`tk-42\` or \`42\`.

## Delegated sign-in

\`POST /api/v1/auth/exchange\` lets your application sign its own users into Open Helpdesk without a password, for single sign-on from your product. It requires the \`auth:exchange\` scope.

1. Your **backend** calls the endpoint with the key and the user's \`email\`, \`firstName\`, \`lastName\` and, optionally, \`role\` (default \`agent\`). Never call it from a browser: the key would be exposed.
2. If no account has that email, one is created (email already verified, random password) and added to the key's workspace with \`role\`. If the account exists, it must already be a member of the workspace; its name is updated if it changed and its role is kept.
3. The response is \`{ "accessToken": "...", "user": { "id": "...", "email": "..." } }\`. \`accessToken\` is a regular Open Helpdesk session token (JWT) for that user. It lasts what the server sets in \`API_TOKEN_EXCHANGE_EXPIRATION\` (one day by default) and comes **without a refresh token**: when it expires, call the exchange again.
4. Use the token as \`Authorization: Bearer <accessToken>\` against the endpoints the web app uses, with the user's own permissions. To open the web app already signed in, the web app reads its session from the browser's \`localStorage\` key \`access_token\` on its own origin, so a page served from the helpdesk's origin has to store it there; the web app has no URL parameter that accepts a token.

Restrictions: the exchange never signs in system administrators, deactivated users or users of other workspaces (\`403\`). Creating or signing in a \`supervisor\` or \`admin\` additionally requires the \`auth:exchange:admin\` scope, which gives whoever holds the key control of the whole workspace.

## Webhooks

Members who manage the workspace settings configure webhooks in **Settings → Webhooks** with a URL, the events to receive and a secret. For each event the server sends a \`POST\` with a JSON body:

\`\`\`json
{
  "event": "ticket.created",
  "data": { "ticketId": "01J...", "ticketName": "Cannot log in", "workspaceId": "01J...", "workspaceSlug": "acme", "...": "..." },
  "timestamp": "2026-10-05T12:00:00.000Z"
}
\`\`\`

\`data\` is the event payload: it always includes \`workspaceId\` and, for these events, \`ticketId\` and \`ticketName\`, plus event-specific fields such as \`oldStatus\`/\`newStatus\`, \`newAssigneeId\`/\`previousAssigneeId\` or \`commentId\`/\`authorId\`/\`commentContent\`. Ignore fields you do not know; new ones may be added.

| Event | Delivered | Meaning |
|---|---|---|
${eventRows}

Headers:

- \`X-Webhook-Event\`: the event name.
- \`X-Webhook-Signature\`: the HMAC-SHA256 of the raw request body keyed with the webhook secret, hex-encoded.

Delivery is attempted once, with a 10 second timeout and no retries. Respond with a \`2xx\` quickly and do the work asynchronously.

Verify the signature against the raw body, before parsing it, with a constant-time comparison:

\`\`\`js
const crypto = require('crypto');

function isValidSignature(rawBody, signatureHeader, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(signatureHeader || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Express: keep the raw body for this route
app.post('/hooks/helpdesk', express.raw({ type: 'application/json' }), (req, res) => {
  if (!isValidSignature(req.body, req.get('X-Webhook-Signature'), process.env.WEBHOOK_SECRET)) {
    return res.sendStatus(401);
  }
  const { event, data } = JSON.parse(req.body.toString('utf8'));
  res.sendStatus(204);
  // handle event...
});
\`\`\`

The signature does not cover a timestamp header; check \`timestamp\` in the body to reject old replays.

## Versioning

\`/api/v1\` is stable: fields and endpoints may be added, but nothing is removed or changes meaning within v1. Breaking changes go to a new version (\`/api/v2\`) served alongside it.
`.trim();
}
