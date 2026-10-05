/** The OpenAPI document as JSON. The web app renders it on its /docs page. */
export const API_OPENAPI_JSON_PATH = 'api/v1/openapi.json';
/** Old and short links to the docs. They redirect to the /docs page of the web app. */
export const API_DOCS_REDIRECTS = ['/docs', '/docs/', '/api/v1/docs', '/api/v1/docs/'];
/** Name of the bearer security scheme every operation requires. */
export const API_KEY_SECURITY_SCHEME = 'apiKey';
/** Vendor extension on each operation naming the API key scope it requires. */
export const REQUIRED_SCOPE_EXTENSION = 'x-required-scope';
/** Vendor extension on the security scheme listing every scope and what it allows. */
export const SCOPES_EXTENSION = 'x-scopes';
/** Top-level vendor extension: the webhook events, each with its payload schema (Redoc convention). */
export const WEBHOOKS_EXTENSION = 'x-webhooks';
/** Top-level vendor extension: how webhooks are delivered (headers, signature, timeout, retries). */
export const WEBHOOK_DELIVERY_EXTENSION = 'x-webhook-delivery';
/** Flag on an x-webhooks entry whose event can be selected but is never sent. */
export const NOT_DELIVERED_EXTENSION = 'x-not-delivered';
/** Top-level vendor extension: the rate limit of the /api/v1 endpoints. */
export const RATE_LIMIT_EXTENSION = 'x-rate-limit';
