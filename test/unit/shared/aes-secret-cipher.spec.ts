import { AesSecretCipher, EnvSecretCipher } from '../../../src/shared/infrastructure/aes-secret-cipher';

describe('AesSecretCipher', () => {
  const cipher = new AesSecretCipher('the-jwt-secret');

  it('reads back what it encrypted, and the stored value does not contain it', () => {
    const stored = cipher.encrypt('syt_bot_token');
    expect(stored).not.toContain('syt_bot_token');
    expect(stored.startsWith('v1:')).toBe(true);
    expect(cipher.decrypt(stored)).toBe('syt_bot_token');
  });

  it('encrypts the same value differently each time', () => {
    expect(cipher.encrypt('same')).not.toBe(cipher.encrypt('same'));
  });

  it('answers null, without throwing, once the secret changed', () => {
    const stored = cipher.encrypt('syt_bot_token');
    expect(new AesSecretCipher('a-new-jwt-secret').decrypt(stored)).toBeNull();
  });

  it('answers null for a value changed in the database, or not one of its own', () => {
    const [version, iv, tag, data] = cipher.encrypt('syt_bot_token').split(':');
    const flipped = data[0] === 'A' ? `B${data.slice(1)}` : `A${data.slice(1)}`;
    expect(cipher.decrypt([version, iv, tag, flipped].join(':'))).toBeNull();
    expect(cipher.decrypt('syt_bot_token')).toBeNull();
    expect(cipher.decrypt('')).toBeNull();
  });

  it('uses SECRETS_ENCRYPTION_KEY when set, otherwise JWT_SECRET', () => {
    const config = (values: Record<string, string>) => ({
      get: (key: string) => values[key],
      getOrThrow: (key: string) => {
        if (!values[key]) throw new Error(`${key} missing`);
        return values[key];
      },
    }) as any;

    const fromJwt = new EnvSecretCipher(config({ JWT_SECRET: 'jwt' }));
    const fromKey = new EnvSecretCipher(config({ JWT_SECRET: 'jwt', SECRETS_ENCRYPTION_KEY: 'own-key' }));
    const stored = fromKey.encrypt('token');

    expect(fromJwt.decrypt(stored)).toBeNull();
    expect(new EnvSecretCipher(config({ JWT_SECRET: 'rotated', SECRETS_ENCRYPTION_KEY: 'own-key' })).decrypt(stored)).toBe('token');
  });
});
