import { INestApplication, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import { ApiController } from '../../../src/api/infrastructure/nest/controllers/api.controller';
import { buildApiDocumentConfig, createApiDocument } from '../../../src/api/infrastructure/nest/openapi/api-docs';
import {
  API_DOCS_PATH,
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
