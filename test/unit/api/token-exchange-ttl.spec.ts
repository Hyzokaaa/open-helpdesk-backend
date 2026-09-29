import { tokenExchangeTtlFromConfig } from '../../../src/api/infrastructure/nest/token-exchange-ttl';

const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as any;

describe('tokenExchangeTtlFromConfig', () => {
  it('reads API_TOKEN_EXCHANGE_EXPIRATION', () => {
    expect(tokenExchangeTtlFromConfig(config({ API_TOKEN_EXCHANGE_EXPIRATION: '2h', JWT_EXPIRATION: '7d' }))).toBe('2h');
  });

  it('still honours the old JWT_EXPIRATION so existing installations keep their setting', () => {
    expect(tokenExchangeTtlFromConfig(config({ JWT_EXPIRATION: '7d' }))).toBe('7d');
  });

  it('defaults to a day', () => {
    expect(tokenExchangeTtlFromConfig(config({}))).toBe('1d');
  });
});
