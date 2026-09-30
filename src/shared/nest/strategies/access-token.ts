import type { AuthUser } from './jwt.strategy';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
  /** Session the token was issued for; absent on tokens from the API token exchange. */
  sid?: string;
  /** Set on single-purpose tokens (password reset, email verification, OAuth code…). */
  type?: string;
  exp?: number;
}

/**
 * The one rule for what a verified JWT may be used as: every place that accepts access tokens
 * (HTTP and websocket) goes through here, so they cannot drift apart. Single-purpose tokens share
 * the signing secret and are refused.
 */
export function authUserFromAccessToken(payload: AccessTokenPayload): AuthUser | null {
  if (payload.type) return null;
  return {
    userId: payload.sub,
    email: payload.email,
    isSystemAdmin: payload.isSystemAdmin,
    isEmailVerified: payload.isEmailVerified,
    sessionId: payload.sid,
  };
}
