import type { INestApplication } from '@nestjs/common';
import { TypeOrmWorkspaceRepository } from '../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';

/** How long the answer for a custom domain is reused before asking the database again. */
const DOMAIN_CACHE_MS = 60_000;

/**
 * CORS for the web app: the origins in CORS_ORIGINS (or FRONTEND_URL), plus the verified custom
 * domain of any workspace, which serves the same app and calls this API cross-origin. Shared by
 * core and cloud, so a custom domain works the same in both.
 */
export function enableAppCors(app: INestApplication): void {
  const corsOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL;
  const allowedOrigins = corsOrigins
    ? corsOrigins.split(',').map((u) => u.trim())
    : ['http://localhost:5173'];

  const verifiedDomainCache = new Map<string, boolean>();
  let cacheExpiry = 0;

  app.enableCors({
    origin: async (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);

      try {
        const now = Date.now();
        if (now > cacheExpiry) {
          verifiedDomainCache.clear();
          cacheExpiry = now + DOMAIN_CACHE_MS;
        }

        const host = new URL(origin).hostname;
        if (verifiedDomainCache.has(host)) return callback(null, verifiedDomainCache.get(host));

        const workspaces = await app.get(TypeOrmWorkspaceRepository).findByCustomDomain(host);
        const allowed = workspaces.some((w) => w.customDomainVerified);
        verifiedDomainCache.set(host, allowed);
        callback(null, allowed);
      } catch {
        callback(null, false);
      }
    },
    exposedHeaders: ['X-Unread-Count', 'Date', 'Content-Disposition'],
    // Lets the browser reuse a preflight answer for an hour instead of repeating the OPTIONS request before most calls
    maxAge: 3600,
  });
}
