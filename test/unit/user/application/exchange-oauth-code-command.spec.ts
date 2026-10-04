import { ExchangeOAuthCodeCommand } from '../../../../src/user/application/commands/exchange-oauth-code.command';
import { OAUTH_CODE_TYPE } from '../../../../src/user/application/commands/oauth-login.command';
import { StartUserSession, SessionPolicy } from '../../../../src/user/domain/services/user-session-start';
import { SignAccessToken } from '../../../../src/user/domain/services/user-session-sign-access-token';
import { User } from '../../../../src/user/domain/entities/user';
import { InvalidCredentialsError } from '../../../../src/shared/domain/errors';
import { TokenService } from '../../../../src/shared/domain/token-service';
import { JwtStrategy } from '../../../../src/shared/nest/strategies/jwt.strategy';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockUserSessionRepository } from '../../../mocks/mock-user-session.repository';
import { MockUsedTokenRepository } from '../../../mocks/mock-used-token.repository';
import { ConsumeOneTimeToken } from '../../../../src/user/domain/services/user-token-consume';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

const policy: SessionPolicy = { accessTokenTtl: '15m', sessionTtlMs: 1000, rememberedSessionTtlMs: 2000, rotationGraceMs: 0 };

class FakeTokenService implements TokenService {
  sign(payload: Record<string, unknown>): string {
    return JSON.stringify(payload);
  }

  verify<T>(token: string): T {
    if (token === 'expired') throw new Error('jwt expired');
    return JSON.parse(token) as T;
  }
}

describe('ExchangeOAuthCodeCommand', () => {
  let users: MockUserRepository;
  let sessions: MockUserSessionRepository;
  let command: ExchangeOAuthCodeCommand;
  const code = (payload: Record<string, unknown>) => JSON.stringify(payload);

  beforeEach(() => {
    users = new MockUserRepository();
    sessions = new MockUserSessionRepository();
    const tokenService = new FakeTokenService();
    command = new ExchangeOAuthCodeCommand(
      new ConsumeOneTimeToken(tokenService, new MockUsedTokenRepository()),
      users,
      new StartUserSession(sessions, new FakeIdGenerator(), new SignAccessToken(tokenService, policy.accessTokenTtl), policy),
    );
    users.seed(new User({
      id: 'user-1', email: 'john@example.com', password: 'x', firstName: 'John', lastName: 'Doe',
      isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
    }));
  });

  it('trades a valid code for a session, remembered when asked', async () => {
    const result = await command.execute({ code: code({ sub: 'user-1', type: OAUTH_CODE_TYPE, jti: 'code-1' }), rememberMe: true });

    expect(result.refreshToken).toBeTruthy();
    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0].rememberMe).toBe(true);
  });

  it('rejects an expired code', async () => {
    await expect(command.execute({ code: 'expired', rememberMe: false })).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects any other kind of token, such as an access token', async () => {
    await expect(command.execute({ code: code({ sub: 'user-1' }), rememberMe: false }))
      .rejects.toThrow(InvalidCredentialsError);
    await expect(command.execute({ code: code({ sub: 'user-1', type: 'password-reset' }), rememberMe: false }))
      .rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects a deactivated user', async () => {
    (await users.findById('user-1'))!.isActive = false;

    await expect(command.execute({ code: code({ sub: 'user-1', type: OAUTH_CODE_TYPE, jti: 'code-1' }), rememberMe: false }))
      .rejects.toThrow(InvalidCredentialsError);
  });
});

describe('JwtStrategy', () => {
  const strategy = new JwtStrategy({ getOrThrow: () => 'secret' } as any);

  it('does not accept single-purpose tokens as access tokens', () => {
    expect(() => strategy.validate({ sub: 'user-1', type: OAUTH_CODE_TYPE, jti: 'code-1' } as any)).toThrow();
    expect(() => strategy.validate({ sub: 'user-1', type: 'password-reset' } as any)).toThrow();
  });

  it('exposes the session of a session access token', () => {
    const user = strategy.validate({ sub: 'user-1', email: 'a@b.c', isSystemAdmin: false, isEmailVerified: true, sid: 's-1' });

    expect(user).toMatchObject({ userId: 'user-1', sessionId: 's-1' });
  });
});
