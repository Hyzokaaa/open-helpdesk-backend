import { Request } from 'express';

/**
 * Who sent a request, as recorded on access events of the audit log. `ip` is the direct
 * connection, which behind a reverse proxy is the proxy itself; `forwardedFor` is what the proxy
 * says the client was (X-Forwarded-For). The header is informational: a caller reaching the
 * backend directly can write anything in it, which is why both are kept.
 */
export interface ClientInfo {
  ip: string | null;
  forwardedFor: string | null;
  userAgent: string | null;
}

export function clientInfo(req: Request): ClientInfo {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(forwarded) ? forwarded.join(', ') : forwarded;
  const userAgent = req.headers['user-agent'];
  return {
    ip: req.socket?.remoteAddress ?? null,
    forwardedFor: forwardedFor ? forwardedFor.slice(0, 200) : null,
    userAgent: userAgent ? userAgent.slice(0, 300) : null,
  };
}
