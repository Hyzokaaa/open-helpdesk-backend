import { ExchangeOAuthCodeCommand } from '../../../../src/user/application/commands/exchange-oauth-code.command';
import { OAuthLoginCommand, OAUTH_CODE_TYPE } from '../../../../src/user/application/commands/oauth-login.command';
import { RequestPasswordResetCommand } from '../../../../src/user/application/commands/request-password-reset.command';
import { ResetPasswordCommand } from '../../../../src/user/application/commands/reset-password.command';
import { AuthenticateOAuth } from '../../../../src/user/domain/services/user-authenticate-oauth';
import { RequestPasswordReset } from '../../../../src/user/domain/services/user-request-password-reset';
import { ResetPassword } from '../../../../src/user/domain/services/user-reset-password';
import { ConsumeOneTimeToken } from '../../../../src/user/domain/services/user-token-consume';
import { StartUserSession, SessionPolicy } from '../../../../src/user/domain/services/user-session-start';
import { SignAccessToken } from '../../../../src/user/domain/services/user-session-sign-access-token';
import { User } from '../../../../src/user/domain/entities/user';
import { InvalidCredentialsError } from '../../../../src/shared/domain/errors';
import { TokenService } from '../../../../src/shared/domain/token-service';
import { EmailService, SendEmailParams } from '../../../../src/email/domain/email.service';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockUserSessionRepository } from '../../../mocks/mock-user-session.repository';
import { MockUsedTokenRepository } from '../../../mocks/mock-used-token.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';

const policy: SessionPolicy = { accessTokenTtl: '15m', sessionTtlMs: 1000, rememberedSessionTtlMs: 2000, rotationGraceMs: 0 };

const encode = (payload: Record<string, unknown>) => Buffer.from(JSON.stringify(payload)).toString('base64url');

/** Signs by encoding the payload, adding the `exp` a real JWT would carry. */
class FakeTokenService implements TokenService {
  sign(payload: Record<string, unknown>): string {
    return encode({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 });
  }

  verify<T>(token: string): T {
    return JSON.parse(Buffer.from(token, 'base64url').toString()) as T;
  }
}

class CapturingEmailService implements Partial<EmailService> {
  sent: SendEmailParams[] = [];
  async send(params: SendEmailParams) {
    this.sent.push(params);
    return { success: true };
  }
}

describe('Single-use sign-in codes and reset links', () => {
  let users: MockUserRepository;
  let usedTokens: MockUsedTokenRepository;
  const tokenService = new FakeTokenService();
  const hasher = new FakePasswordHasher();

  beforeEach(() => {
    users = new MockUserRepository();
    usedTokens = new MockUsedTokenRepository();
    users.seed(new User({
      id: 'user-1', email: 'john@example.com', password: 'hashed:old', firstName: 'John', lastName: 'Doe',
      isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
    }));
  });

  describe('OAuth sign-in code', () => {
    const exchange = (code: string) => new ExchangeOAuthCodeCommand(
      new ConsumeOneTimeToken(tokenService, usedTokens),
      users,
      new StartUserSession(new MockUserSessionRepository(), new FakeIdGenerator(), new SignAccessToken(tokenService, policy.accessTokenTtl), policy),
    ).execute({ code, rememberMe: false });

    const issueCode = async () => {
      const login = new OAuthLoginCommand(new AuthenticateOAuth(new FakeIdGenerator(), users, hasher), tokenService);
      return (await login.execute({ email: 'john@example.com', firstName: 'John', lastName: 'Doe', authProvider: 'google', emailVerified: true })).code;
    };

    it('opens a session once, and a replay of the same code (leaked from history or logs) opens nothing', async () => {
      const code = await issueCode();

      await expect(exchange(code)).resolves.toHaveProperty('refreshToken');
      await expect(exchange(code)).rejects.toThrow(InvalidCredentialsError);
    });

    it('refuses a code that carries no single-use id', async () => {
      await expect(exchange(encode({ sub: 'user-1', type: OAUTH_CODE_TYPE, exp: 9999999999 })))
        .rejects.toThrow(InvalidCredentialsError);
    });
  });

  describe('password reset link', () => {
    const reset = (token: string, newPassword: string) =>
      new ResetPasswordCommand(new ResetPassword(users, hasher), new ConsumeOneTimeToken(tokenService, usedTokens))
        .execute({ token, newPassword });

    const issueLink = async () => {
      const email = new CapturingEmailService();
      await new RequestPasswordResetCommand(new RequestPasswordReset(users), tokenService, email as unknown as EmailService)
        .execute({ email: 'john@example.com', frontendUrl: 'https://app' });
      return email.sent[0].html.match(/token=([A-Za-z0-9_-]+)/)![1];
    };

    it('sets the password once, and someone holding the same link afterwards cannot set it again', async () => {
      const token = await issueLink();

      await reset(token, 'chosen-by-john');
      await expect(reset(token, 'chosen-by-attacker')).rejects.toThrow(InvalidCredentialsError);
      expect((await users.findById('user-1'))!.password).toBe('hashed:chosen-by-john');
    });

    it('does not accept a sign-in code as a reset link', async () => {
      const code = encode({ sub: 'user-1', type: OAUTH_CODE_TYPE, jti: 'x', exp: 9999999999 });
      await expect(reset(code, 'whatever')).rejects.toThrow(InvalidCredentialsError);
    });
  });
});
