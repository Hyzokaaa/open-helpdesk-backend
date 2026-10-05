import { API_KEY_SECURITY_SCHEME } from './api-docs.constants';

export interface ApiReferencePageOptions {
  /** URL of the OpenAPI document, relative to the page. */
  documentUrl: string;
  /** URL of the Scalar browser bundle, relative to the page. */
  scriptUrl: string;
}

/**
 * Brand green for light mode; a lighter shade of it keeps links readable on the dark background.
 * Scalar inserts customCss before its theme, so the doubled class outranks the theme's selectors.
 */
const CUSTOM_CSS = `
.light-mode.light-mode {
  --scalar-color-accent: #059669;
  --scalar-background-accent: #0596691f;
  --scalar-sidebar-color-active: #059669;
  --scalar-sidebar-item-active-background: #0596691a;
}
.dark-mode.dark-mode {
  --scalar-color-accent: #34d399;
  --scalar-background-accent: #34d3991f;
  --scalar-sidebar-color-active: #34d399;
  --scalar-sidebar-item-active-background: #34d3991a;
}
`.trim();

/**
 * Scalar configuration. Everything that would reach a third-party service is turned off:
 * telemetry, the hosted fonts, the AI agent, the MCP generator and the developer toolbar. The page CSP
 * (connect-src 'self') backs this up.
 */
export function buildApiReferenceConfiguration(): Record<string, unknown> {
  return {
    theme: 'default',
    layout: 'modern',
    showSidebar: true,
    hideDarkModeToggle: false,
    withDefaultFonts: false,
    telemetry: false,
    showDeveloperTools: 'never',
    agent: { disabled: true },
    mcp: { disabled: true },
    persistAuth: true,
    authentication: { preferredSecurityScheme: API_KEY_SECURITY_SCHEME },
    defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
    // Only the languages integrators of this API are likely to use
    hiddenClients: Object.fromEntries(
      ['c', 'clojure', 'csharp', 'dart', 'fsharp', 'go', 'http', 'java', 'julia', 'kotlin', 'objc', 'ocaml', 'powershell', 'r', 'ruby', 'rust', 'swift']
        .map((target) => [target, true]),
    ),
    customCss: CUSTOM_CSS,
  };
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * The reference page. It carries no inline script: Scalar reads the document URL and its
 * configuration from the attributes of the #api-reference element, so the CSP can stay at
 * script-src 'self'.
 */
export function renderApiReferencePage(options: ApiReferencePageOptions): string {
  const configuration = escapeAttribute(JSON.stringify(buildApiReferenceConfiguration()));
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <title>Open Helpdesk API</title>
  </head>
  <body>
    <script id="api-reference" type="application/json" data-url="${escapeAttribute(options.documentUrl)}" data-configuration="${configuration}"></script>
    <script src="${escapeAttribute(options.scriptUrl)}"></script>
  </body>
</html>
`;
}

/**
 * Content-Security-Policy of the reference page only. Scalar injects its styles at runtime,
 * hence 'unsafe-inline' for styles; scripts, fonts and requests stay on this origin, plus the
 * public API origin when API_URL points elsewhere so "Test request" can reach it.
 */
export function buildApiReferenceCsp(apiOrigin?: string): string {
  const connect = ["'self'", ...(apiOrigin ? [apiOrigin] : [])].join(' ');
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
