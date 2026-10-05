import { INestApplication, Type } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { ApiModule } from '../../../api.module';
import { buildApiGuide } from './api-docs.guide';
import {
  API_DOCS_PATH,
  API_DOCS_SCRIPT_PATH,
  API_DOCS_SHORTCUTS,
  API_KEY_SECURITY_SCHEME,
  API_OPENAPI_JSON_PATH,
} from './api-docs.constants';
import { buildApiReferenceCsp, renderApiReferencePage } from './api-docs.page';

export interface ApiDocsOptions {
  version: string;
  /** Public base URL of this backend (API_URL). Without it the document uses relative URLs. */
  serverUrl?: string;
}

export function buildApiDocumentConfig(options: ApiDocsOptions): Omit<OpenAPIObject, 'paths'> {
  const builder = new DocumentBuilder()
    .setTitle('Open Helpdesk API')
    .setDescription(buildApiGuide())
    .setVersion(options.version)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'ohd_...', description: 'API key (ohd_...)' },
      API_KEY_SECURITY_SCHEME,
    )
    .addTag('Tickets', 'Read and manage the tickets of the key\'s workspace.')
    .addTag('Comments', 'Read and add ticket comments.')
    .addTag('Members', 'The members of the key\'s workspace.')
    .addTag('Authentication', 'Delegated sign-in for your own users.');

  const serverUrl = normalizeServerUrl(options.serverUrl);
  if (serverUrl) builder.addServer(serverUrl);

  return builder.build();
}

function normalizeServerUrl(url?: string): string {
  return url?.trim().replace(/\/+$/, '') ?? '';
}

/**
 * Builds the document from the public API controller only, so internal app routes never
 * appear in it. `modules` exists for tests, which scan a stand-in module.
 */
export function createApiDocument(
  app: INestApplication,
  options: ApiDocsOptions,
  modules: Type<unknown>[] = [ApiModule],
): OpenAPIObject {
  return SwaggerModule.createDocument(app, buildApiDocumentConfig(options), { include: modules });
}

interface ScalarBundle {
  file: string;
  version: string;
}

/** The Scalar standalone browser bundle shipped in node_modules, served from this backend (no CDN). */
function resolveScalarBundle(): ScalarBundle {
  const dist = dirname(require.resolve('@scalar/api-reference'));
  const pkg = JSON.parse(readFileSync(join(dist, '..', 'package.json'), 'utf8')) as { version: string };
  return { file: join(dist, 'browser', 'standalone.js'), version: pkg.version };
}

function originOf(url: string): string | undefined {
  try {
    return url ? new URL(url).origin : undefined;
  } catch {
    return undefined;
  }
}

/** Last segment of a path, so page URLs stay relative and work behind a proxy prefix. */
function lastSegment(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * Serves the API reference page (Scalar), its script, the JSON document and the /docs
 * shortcut. These are plain Express routes registered outside Nest's router, so the global
 * guards (throttling, JWT, API key) do not run for them and they stay public.
 */
export function setupApiDocs(app: INestApplication, options: ApiDocsOptions): void {
  const document = createApiDocument(app, options);
  const bundle = resolveScalarBundle();
  const serverUrl = normalizeServerUrl(options.serverUrl);
  const csp = buildApiReferenceCsp(originOf(serverUrl));

  // Relative to /api/v1/docs, so they resolve the same with or without a proxy path prefix
  const page = renderApiReferencePage({
    documentUrl: lastSegment(API_OPENAPI_JSON_PATH),
    scriptUrl: `${API_DOCS_SCRIPT_PATH.slice(API_DOCS_PATH.lastIndexOf('/') + 1)}?v=${encodeURIComponent(bundle.version)}`,
  });

  const http = app.getHttpAdapter();

  http.get(`/${API_DOCS_PATH}`, (req: Request, res: Response) => {
    // A trailing slash would shift the relative URLs of the page
    if (req.path.endsWith('/')) return res.redirect(301, `../${lastSegment(API_DOCS_PATH)}`);
    res
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': csp,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-cache',
      })
      .send(page);
  });

  http.get(`/${API_DOCS_SCRIPT_PATH}`, (_req: Request, res: Response) => {
    res.set('X-Content-Type-Options', 'nosniff');
    // The page requests it with ?v=<scalar version>, so an upgrade changes the URL
    res.sendFile(bundle.file, { maxAge: '365d', immutable: true });
  });

  http.get(`/${API_OPENAPI_JSON_PATH}`, (_req: Request, res: Response) => {
    res.json(document);
  });

  // With API_URL set the API may sit under a path behind a proxy, so the redirect follows it
  const target = `${serverUrl}/${API_DOCS_PATH}`;
  for (const path of API_DOCS_SHORTCUTS) {
    http.get(path, (_req: unknown, res: unknown) => http.redirect(res, 302, target));
  }
}
