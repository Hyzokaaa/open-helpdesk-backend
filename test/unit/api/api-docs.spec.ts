import { INestApplication, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import { ApiController } from '../../../src/api/infrastructure/nest/controllers/api.controller';
import { buildApiDocumentConfig, createApiDocument } from '../../../src/api/infrastructure/nest/openapi/api-docs';
import {
  buildApiReferenceConfiguration,
  buildApiReferenceCsp,
  renderApiReferencePage,
} from '../../../src/api/infrastructure/nest/openapi/api-docs.page';
import {
  API_DOCS_PATH,
  API_DOCS_SCRIPT_PATH,
  API_DOCS_SHORTCUTS,
  API_KEY_SECURITY_SCHEME,
  API_OPENAPI_JSON_PATH,
} from '../../../src/api/infrastructure/nest/openapi/api-docs.constants';
import { ALL_API_KEY_SCOPES } from '../../../src/api-key/domain/enums/api-key-scope.enum';

/** Holds the public controller alone; its repositories are stubbed, the document never calls them. */
@Module({ controllers: [ApiController] })
class ApiDocsTestModule {}

const HTTP_METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;

function operations(document: OpenAPIObject) {
  return Object.entries(document.paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((m) => (item as any)[m]).map((m) => ({ path, method: m, op: (item as any)[m] })),
  );
}

describe('public API OpenAPI document', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ApiDocsTestModule] })
      .useMocker((token) => (token === ConfigService ? { get: () => undefined } : {}))
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    document = createApiDocument(app, { version: '9.9.9' }, [ApiDocsTestModule]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the docs under /api/v1, with /docs as a shortcut', () => {
    expect(API_DOCS_PATH).toBe('api/v1/docs');
    expect(API_OPENAPI_JSON_PATH).toBe('api/v1/openapi.json');
    expect(API_DOCS_SHORTCUTS).toEqual(['/docs', '/docs/']);
    expect(API_DOCS_SCRIPT_PATH).toBe('api/v1/docs/assets/scalar.js');
  });

  it('documents only /api/v1 paths, all nine operations of the public controller', () => {
    const paths = Object.keys(document.paths);
    expect(paths.every((p) => p.startsWith('/api/v1/'))).toBe(true);
    expect(operations(document).map(({ method, path }) => `${method.toUpperCase()} ${path}`).sort()).toEqual([
      'DELETE /api/v1/tickets/{id}',
      'GET /api/v1/members',
      'GET /api/v1/tickets',
      'GET /api/v1/tickets/{id}',
      'GET /api/v1/tickets/{id}/comments',
      'PATCH /api/v1/tickets/{id}',
      'POST /api/v1/auth/exchange',
      'POST /api/v1/tickets',
      'POST /api/v1/tickets/{id}/comments',
    ]);
  });

  it('requires the API key and names a known scope on every operation', () => {
    for (const { path, method, op } of operations(document)) {
      const label = `${method} ${path}`;
      expect({ label, security: op.security }).toEqual({ label, security: [{ [API_KEY_SECURITY_SCHEME]: [] }] });
      const scope = /Requires scope `([^`]+)`/.exec(op.description ?? '')?.[1];
      expect({ label, known: ALL_API_KEY_SCOPES.includes(scope as any) }).toEqual({ label, known: true });
      expect({ label, statuses: ['401', '403', '429'].every((s) => op.responses[s]) }).toEqual({ label, statuses: true });
    }
  });

  it('declares the bearer scheme and keeps the server relative without API_URL', () => {
    expect(document.components?.securitySchemes?.[API_KEY_SECURITY_SCHEME]).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(document.info).toMatchObject({ title: 'Open Helpdesk API', version: '9.9.9' });
    expect(document.servers).toEqual([]);
  });

  it('uses API_URL as the server when set', () => {
    const config = buildApiDocumentConfig({ version: '1.0.0', serverUrl: 'https://api.example.com/' });
    expect(config.servers).toEqual([{ url: 'https://api.example.com' }]);
  });

  it('states only the current version, without promising a future one', () => {
    expect(document.info.description).toContain('served under `/api/v1`');
    expect(document.info.description).not.toMatch(/\/api\/v2|new version|breaking change/i);
  });

  it('covers every scope in the guide', () => {
    for (const scope of ALL_API_KEY_SCOPES) expect(document.info.description).toContain(`| \`${scope}\` |`);
  });
});

describe('public API reference page', () => {
  const html = renderApiReferencePage({ documentUrl: 'openapi.json', scriptUrl: 'docs/assets/scalar.js?v=1.0.0' });

  it('loads the self-hosted Scalar bundle and the local document, with no inline script', () => {
    expect(html).toContain('<title>Open Helpdesk API</title>');
    expect(html).toContain('<script src="docs/assets/scalar.js?v=1.0.0"></script>');
    expect(html).toContain('data-url="openapi.json"');
    // The configuration element is data, not an executable script
    expect(html).toMatch(/<script id="api-reference" type="application\/json"[^>]*><\/script>/);
  });

  it('references no external script, stylesheet or font', () => {
    expect(html).not.toMatch(/(src|href)="(https?:)?\/\//i);
    expect(html).not.toMatch(/cdn|jsdelivr|unpkg/i);
    expect(html).not.toMatch(/<link/i);
  });

  it('turns off Scalar features that call third-party services and keeps the API key in the browser', () => {
    expect(buildApiReferenceConfiguration()).toMatchObject({
      telemetry: false,
      withDefaultFonts: false,
      showDeveloperTools: 'never',
      agent: { disabled: true },
      mcp: { disabled: true },
      persistAuth: true,
      authentication: { preferredSecurityScheme: API_KEY_SECURITY_SCHEME },
      defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
    });
    const hidden = buildApiReferenceConfiguration().hiddenClients as Record<string, boolean>;
    for (const shown of ['shell', 'js', 'node', 'python', 'php']) expect(hidden[shown]).toBeUndefined();
  });

  it('allows only same-origin scripts and requests, plus the API origin when given', () => {
    const csp = buildApiReferenceCsp();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*(unsafe-inline|unsafe-eval|https?:)/);
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(buildApiReferenceCsp('https://api.example.com')).toContain("connect-src 'self' https://api.example.com");
  });
});
