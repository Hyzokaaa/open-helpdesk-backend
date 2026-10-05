/**
 * Rate limits read by the throttler and by the public API document, so the documented numbers
 * are the enforced ones. Routes with their own @Throttle override these per handler.
 */
export interface ThrottleLimit {
  /** Window length in milliseconds. */
  ttl: number;
  /** Requests allowed per window, per client IP and per endpoint. */
  limit: number;
}

/** Applies to every route that does not set its own limit (ThrottlerModule.forRoot). */
export const GLOBAL_THROTTLE: ThrottleLimit = { ttl: 60_000, limit: 100 };

/** Applies to every /api/v1 endpoint (class-level @Throttle on the public API controller). */
export const PUBLIC_API_THROTTLE: ThrottleLimit = { ttl: 60_000, limit: 100 };
