import { JwtService } from '@nestjs/jwt';
import { AccessTokenVerifier } from '../../../src/shared/infrastructure/access-token-verifier';

describe('AccessTokenVerifier', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const verifier = new AccessTokenVerifier(jwt);
  const claims = { sub: 'user-1', email: 'a@b.c', isSystemAdmin: false, isEmailVerified: true, sid: 's-1' };

  it('accepts a session access token and reports when it expires', () => {
    const result = verifier.verify(jwt.sign(claims, { expiresIn: '15m' }));

    expect(result?.user).toMatchObject({ userId: 'user-1', sessionId: 's-1' });
    expect(result!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('refuses single-purpose tokens, expired tokens and foreign signatures', () => {
    expect(verifier.verify(jwt.sign({ sub: 'user-1', type: 'password-reset' }, { expiresIn: '1h' }))).toBeNull();
    expect(verifier.verify(jwt.sign(claims, { expiresIn: '-1s' }))).toBeNull();
    expect(verifier.verify(new JwtService({ secret: 'other' }).sign(claims, { expiresIn: '15m' }))).toBeNull();
    expect(verifier.verify(undefined)).toBeNull();
  });
});
