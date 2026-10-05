import { INestApplication, Type } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ApiModule } from '../../../api.module';
import { buildApiGuide } from './api-docs.guide';
import { API_DOCS_PATH, API_DOCS_SHORTCUTS, API_KEY_SECURITY_SCHEME, API_OPENAPI_JSON_PATH } from './api-docs.constants';

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

/**
 * Serves the Swagger UI, the JSON document and the /docs shortcut. These are plain Express
 * routes registered outside Nest's router, so the global guards (throttling, JWT, API key)
 * do not run for them and they stay public.
 */
export function setupApiDocs(app: INestApplication, options: ApiDocsOptions): void {
  const document = createApiDocument(app, options);
  SwaggerModule.setup(API_DOCS_PATH, app, document, {
    jsonDocumentUrl: API_OPENAPI_JSON_PATH,
    customSiteTitle: 'Open Helpdesk API',
    swaggerOptions: { persistAuthorization: true },
  });

  // With API_URL set the API may sit under a path behind a proxy, so the redirect follows it
  const target = `${normalizeServerUrl(options.serverUrl)}/${API_DOCS_PATH}`;
  const http = app.getHttpAdapter();
  for (const path of API_DOCS_SHORTCUTS) {
    http.get(path, (_req: unknown, res: unknown) => http.redirect(res, 302, target));
  }
}
