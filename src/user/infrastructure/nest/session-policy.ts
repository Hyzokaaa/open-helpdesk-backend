import { ConfigService } from '@nestjs/config';
import { SessionPolicy } from '../../domain/services/user-session-start';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function positiveNumber(config: ConfigService, key: string, fallback: number): number {
  const value = Number(config.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Session lifetimes, from the environment:
 * - SESSION_ACCESS_TOKEN_EXPIRATION (default 15m): access tokens, renewed silently by the client
 * - SESSION_TTL_HOURS (default 24): sessions without "keep me signed in", counted from sign-in
 * - SESSION_REMEMBER_TTL_DAYS (default 30): remembered sessions, extended on every use
 *
 * Tokens issued outside sessions, such as the API token exchange, have their own settings.
 */
export function sessionPolicyFromConfig(config: ConfigService): SessionPolicy {
  return {
    accessTokenTtl: config.get<string>('SESSION_ACCESS_TOKEN_EXPIRATION') || '15m',
    sessionTtlMs: positiveNumber(config, 'SESSION_TTL_HOURS', 24) * HOUR_MS,
    rememberedSessionTtlMs: positiveNumber(config, 'SESSION_REMEMBER_TTL_DAYS', 30) * DAY_MS,
    rotationGraceMs: 30 * 1000,
  };
}
