import { INestApplication, Type } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ApiModule } from '../../../api.module';
import {
  ALL_API_KEY_SCOPES,
  ApiKeyScope,
  DEFAULT_API_KEY_SCOPES,
} from '../../../../api-key/domain/enums/api-key-scope.enum';
import {
  API_DOCS_REDIRECTS,
  API_KEY_SECURITY_SCHEME,
  API_OPENAPI_JSON_PATH,
  RATE_LIMIT_EXTENSION,
  SCOPES_EXTENSION,
  WEBHOOK_DELIVERY_EXTENSION,
  WEBHOOKS_EXTENSION,
} from './api-docs.constants';
import { buildWebhookDeliveryExtension, buildWebhooksExtension, WEBHOOK_PAYLOAD_MODELS } from './api-docs.webhooks';
import { buildRateLimitExtension } from './api-docs.rate-limit';
import { DocumentedScope, SCOPE_DESCRIPTIONS } from './api-docs.scopes';

export interface ApiDocsOptions {
  version: string;
  /** Public base URL of this backend (API_URL). Without it the document uses relative URLs. */
  serverUrl?: string;
  /** Base URL of the web app (FRONTEND_URL), whose /docs page holds the guides and the reference. */
  frontendUrl?: string;
}

const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

function withoutTrailingSlash(url?: string): string {
  return url?.trim().replace(/\/+$/, '') ?? '';
}

/** The /docs page of the web app, where the old docs links redirect. */
export function docsPageUrl(frontendUrl?: string): string {
  return `${withoutTrailingSlash(frontendUrl) || DEFAULT_FRONTEND_URL}/docs`;
}

function documentedScopes(): DocumentedScope[] {
  return ALL_API_KEY_SCOPES.map((scope) => ({
    scope,
    description: SCOPE_DESCRIPTIONS[scope],
    default: (DEFAULT_API_KEY_SCOPES as ApiKeyScope[]).includes(scope),
  }));
}

export function buildApiDocumentConfig(options: ApiDocsOptions): Omit<OpenAPIObject, 'paths'> {
  const builder = new DocumentBuilder()
    .setTitle('Open Helpdesk API')
    .setDescription(
      `The public REST API of Open Helpdesk. Guides (authentication, scopes, errors, webhooks) and this reference: ${docsPageUrl(options.frontendUrl)}`,
    )
    .setVersion(options.version)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'ohd_...', description: 'API key (ohd_...)' },
      API_KEY_SECURITY_SCHEME,
    )
    .addTag('Tickets', 'Read and manage the tickets of the key\'s workspace.')
    .addTag('Comments', 'Read and add ticket comments.')
    .addTag('Members', 'The members of the key\'s workspace.')
    .addTag('Authentication', 'Delegated sign-in for your own users.');

  const serverUrl = withoutTrailingSlash(options.serverUrl);
  if (serverUrl) builder.addServer(serverUrl);

  const config = builder.build();
  // Every scope, including those no operation requires (auth:exchange:admin), for the scopes table
  const scheme = config.components?.securitySchemes?.[API_KEY_SECURITY_SCHEME] as Record<string, unknown> | undefined;
  if (scheme) scheme[SCOPES_EXTENSION] = documentedScopes();
  return config;
}

/**
 * Builds the document from the public API controller only, so internal app routes never
 * appear in it, plus the webhook and rate limit extensions. `modules` exists for tests, which scan a stand-in module.
 */
export function createApiDocument(
  app: INestApplication,
  options: ApiDocsOptions,
  modules: Type<unknown>[] = [ApiModule],
): OpenAPIObject {
  const document = SwaggerModule.createDocument(app, buildApiDocumentConfig(options), {
    include: modules,
    extraModels: WEBHOOK_PAYLOAD_MODELS,
  });
  // Facts the guides used to copy by hand: webhook events and payloads, delivery, rate limit
  const extended = document as OpenAPIObject & Record<string, unknown>;
  extended[WEBHOOKS_EXTENSION] = buildWebhooksExtension();
  extended[WEBHOOK_DELIVERY_EXTENSION] = buildWebhookDeliveryExtension();
  extended[RATE_LIMIT_EXTENSION] = buildRateLimitExtension();
  return document;
}

/**
 * Serves the JSON document and redirects the docs links to the web app. These are plain
 * Express routes registered outside Nest's router, so the global guards (throttling, JWT,
 * API key) do not run for them and they stay public.
 */
export function setupApiDocs(app: INestApplication, options: ApiDocsOptions): void {
  const document = createApiDocument(app, options);
  const http = app.getHttpAdapter();

  http.get(`/${API_OPENAPI_JSON_PATH}`, (_req: Request, res: Response) => {
    // The document is public: any origin may read it, without credentials
    res.set('Access-Control-Allow-Origin', '*').json(document);
  });

  const target = docsPageUrl(options.frontendUrl);
  for (const path of API_DOCS_REDIRECTS) {
    http.get(path, (_req: unknown, res: unknown) => http.redirect(res, 302, target));
  }
}
