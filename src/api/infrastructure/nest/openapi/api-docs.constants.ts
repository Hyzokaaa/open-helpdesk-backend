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
