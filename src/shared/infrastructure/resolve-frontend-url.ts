import { Logger } from '@nestjs/common';
import { Request } from 'express';

const logger = new Logger('ResolveFrontendUrl');

export function resolveFrontendUrl(
  req: Request,
  allowedUrls: string[],
  defaultUrl: string,
): string {
  const header = req.headers['x-frontend-url'];
  const candidate = Array.isArray(header) ? header[0] : header;

  if (candidate && allowedUrls.includes(candidate)) {
    return candidate;
  }

  if (candidate) {
    logger.warn(`Unrecognized X-Frontend-URL: ${candidate} — add it to FRONTEND_URL if this is a valid origin`);
  }

  return defaultUrl;
}
