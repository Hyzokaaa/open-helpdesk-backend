import { INestApplication, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import { ApiController } from '../../../src/api/infrastructure/nest/controllers/api.controller';
import {
  buildApiDocumentConfig,
  createApiDocument,
  docsPageUrl,
  setupApiDocs,
} from '../../../src/api/infrastructure/nest/openapi/api-docs';
import {
  API_DOCS_REDIRECTS,
  API_KEY_SECURITY_SCHEME,
  API_OPENAPI_JSON_PATH,
  REQUIRED_SCOPE_EXTENSION,
  SCOPES_EXTENSION,
} from '../../../src/api/infrastructure/nest/openapi/api-docs.constants';
import { ALL_API_KEY_SCOPES, DEFAULT_API_KEY_SCOPES } from '../../../src/api-key/domain/enums/api-key-scope.enum';

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

  it('serves the document under /api/v1 and redirects the old docs links', () => {
    expect(API_OPENAPI_JSON_PATH).toBe('api/v1/openapi.json');
    expect(API_DOCS_REDIRECTS).toEqual(['/docs', '/docs/', '/api/v1/docs', '/api/v1/docs/']);
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
      expect({ label, extension: op[REQUIRED_SCOPE_EXTENSION] }).toEqual({ label, extension: scope });
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

  it('keeps the guides out of the document and points to the docs page instead', () => {
    expect(document.info.description).toContain('http://localhost:5173/docs');
    expect(document.info.description).not.toMatch(/##|\/api\/v2|new version|breaking change/i);
    const config = buildApiDocumentConfig({ version: '1.0.0', frontendUrl: 'https://help.example.com/' });
    expect(config.info.description).toContain('https://help.example.com/docs');
  });

  it('lists every scope on the security scheme, marking the default ones', () => {
    const scopes = (document.components?.securitySchemes?.[API_KEY_SECURITY_SCHEME] as any)[SCOPES_EXTENSION];
    expect(scopes.map((s: any) => s.scope)).toEqual(ALL_API_KEY_SCOPES);
    for (const s of scopes) {
      expect(s.description).toEqual(expect.any(String));
      expect(s.default).toBe(DEFAULT_API_KEY_SCOPES.includes(s.scope));
    }
  });
});

describe('public API docs routes', () => {
  type Handler = (req: unknown, res: any) => void;

  function fakeApp() {
    const routes = new Map<string, Handler>();
    const redirects: Array<{ status: number; url: string }> = [];
    const http = {
      get: (path: string, handler: Handler) => routes.set(path, handler),
      redirect: (_res: unknown, status: number, url: string) => redirects.push({ status, url }),
    };
    return { routes, redirects, app: { getHttpAdapter: () => http } };
  }

  function fakeResponse() {
    const res = { headers: {} as Record<string, string>, body: undefined as unknown };
    return Object.assign(res, {
      set(name: string, value: string) { res.headers[name] = value; return this; },
      json(body: unknown) { res.body = body; return this; },
    });
  }

  let createDocument: jest.SpyInstance;

  beforeEach(() => {
    // Only the routes are under test here; the document itself is covered above
    createDocument = jest.spyOn(require('@nestjs/swagger').SwaggerModule, 'createDocument').mockReturnValue({ openapi: '3.0.0' });
  });

  afterEach(() => createDocument.mockRestore());

  it('serves the JSON document readable from any origin', () => {
    const { routes, app } = fakeApp();
    setupApiDocs(app as any, { version: '1.0.0' });
    const res = fakeResponse();
    routes.get(`/${API_OPENAPI_JSON_PATH}`)!({}, res);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.body).toEqual({ openapi: '3.0.0' });
  });

  it('redirects /docs and /api/v1/docs to the docs page of the web app', () => {
    const { routes, redirects, app } = fakeApp();
    setupApiDocs(app as any, { version: '1.0.0', frontendUrl: 'https://help.example.com//' });
    for (const path of ['/docs', '/docs/', '/api/v1/docs', '/api/v1/docs/']) routes.get(path)!({}, {});
    expect(redirects).toEqual(Array(4).fill({ status: 302, url: 'https://help.example.com/docs' }));
    expect(routes.has('/api/v1/docs/assets/scalar.js')).toBe(false);
  });

  it('falls back to the default frontend URL', () => {
    expect(docsPageUrl()).toBe('http://localhost:5173/docs');
    expect(docsPageUrl(' https://a.example.com/ ')).toBe('https://a.example.com/docs');
  });
});
