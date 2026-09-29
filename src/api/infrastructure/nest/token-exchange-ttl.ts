import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Lifetime of the tokens the API token exchange hands to integrations. They get no refresh
 * token, so this is how long an embedded session lasts.
 *
 * Read from API_TOKEN_EXCHANGE_EXPIRATION. JWT_EXPIRATION is its old name, from when it was the
 * default for every token; it is still honoured so existing installations keep their setting.
 */
export function tokenExchangeTtlFromConfig(config: ConfigService): string {
  const current = config.get<string>('API_TOKEN_EXCHANGE_EXPIRATION');
  if (current) return current;

  const legacy = config.get<string>('JWT_EXPIRATION');
  if (legacy) {
    new Logger('Config').warn('JWT_EXPIRATION is deprecated: rename it to API_TOKEN_EXCHANGE_EXPIRATION');
    return legacy;
  }
  return '1d';
}
