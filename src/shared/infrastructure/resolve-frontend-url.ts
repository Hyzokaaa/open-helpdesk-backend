import { Logger } from '@nestjs/common';
import { Request } from 'express';

const logger = new Logger('ResolveFrontendUrl');

export async function resolveFrontendUrl(
  req: Request,
  defaultUrl: string,
  isVerifiedDomain?: (hostname: string) => Promise<boolean>,
): Promise<string> {
  const header = req.headers['x-frontend-url'];
  const candidate = Array.isArray(header) ? header[0] : header;

  if (!candidate || candidate === defaultUrl) {
    return defaultUrl;
  }

  if (isVerifiedDomain) {
    try {
      const hostname = new URL(candidate).hostname;
      if (await isVerifiedDomain(hostname)) {
        return candidate;
      }
    } catch {}
  }

  logger.warn(`Unrecognized X-Frontend-URL: ${candidate}`);
  return defaultUrl;
}
