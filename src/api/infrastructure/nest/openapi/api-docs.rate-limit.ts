import { PUBLIC_API_THROTTLE } from '../../../../shared/nest/throttling/throttle.constants';

/**
 * x-rate-limit: the throttling of the /api/v1 endpoints, built from the constant the public
 * API controller passes to @Throttle. The tracker, key and headers are those of the default
 * ThrottlerGuard (@nestjs/throttler) with its in-memory storage, which the app uses unchanged.
 */
export function buildRateLimitExtension(): Record<string, unknown> {
  const { limit, ttl } = PUBLIC_API_THROTTLE;
  return {
    limit,
    windowSeconds: ttl / 1000,
    scope: 'ip-per-endpoint',
    description:
      `Each endpoint allows ${limit} requests per ${ttl / 1000} seconds per client IP address. Every endpoint has its own counter, ` +
      'and requests are counted before authentication, so rejected requests count too.',
    tracker: 'ip',
    trackerNote:
      'The IP is the address of the direct peer: the server does not enable Express "trust proxy", so behind a reverse proxy every client shares the proxy\'s counter.',
    perEndpoint: true,
    storage: 'memory',
    storageNote: 'Counters live in the memory of each server process: they reset on restart and are not shared between instances.',
    exceededStatus: 429,
    headers: [
      { name: 'X-RateLimit-Limit', description: 'Requests allowed in the window.' },
      { name: 'X-RateLimit-Remaining', description: 'Requests left in the current window.' },
      { name: 'X-RateLimit-Reset', description: 'Seconds until the window resets.' },
      { name: 'Retry-After', description: 'On 429 responses only: seconds to wait before retrying.' },
    ],
  };
}
