import { User } from '../../../../src/user/domain/entities/user';
import { StartUserSession, SessionPolicy } from '../../../../src/user/domain/services/user-session-start';
import { RefreshUserSession } from '../../../../src/user/domain/services/user-session-refresh';
import { EndUserSession } from '../../../../src/user/domain/services/user-session-end';
import { RevokeUserSessions } from '../../../../src/user/domain/services/user-sessions-revoke';
import { PurgeStaleSessions } from '../../../../src/user/domain/services/user-sessions-purge';
import { SignAccessToken } from '../../../../src/user/domain/services/user-session-sign-access-token';
import { SessionSecret } from '../../../../src/user/domain/services/user-session-secret';
import { InvalidCredentialsError } from '../../../../src/shared/domain/errors';
import { TokenService } from '../../../../src/shared/domain/token-service';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockUserSessionRepository } from '../../../mocks/mock-user-session.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const policy: SessionPolicy = {
  accessTokenTtl: '15m',
  sessionTtlMs: DAY,
  rememberedSessionTtlMs: 30 * DAY,
  rotationGraceMs: 30 * 1000,
};

// Encodes the payload so tests can read the claims back
class FakeTokenService implements TokenService {
  sign(payload: Record<string, unknown>, options: { expiresIn: string }): string {
    return JSON.stringify({ ...payload, expiresIn: options.expiresIn });
  }

  verify<T>(token: string): T {
    return JSON.parse(token) as T;
  }
}

const claims = (token: string) => JSON.parse(token);

describe('user sessions', () => {
  let sessions: MockUserSessionRepository;
  let users: MockUserRepository;
  let start: StartUserSession;
  let refresh: RefreshUserSession;
  const t0 = new Date('2026-09-01T10:00:00Z');
  const at = (ms: number) => new Date(t0.getTime() + ms);

  const seedUser = (overrides: Partial<{ isActive: boolean; isSystemAdmin: boolean }> = {}) => {
    const user = new User({
      id: 'user-1',
      email: 'john@example.com',
      password: 'hashed:x',
      firstName: 'John',
      lastName: 'Doe',
      isActive: overrides.isActive ?? true,
      isSystemAdmin: overrides.isSystemAdmin ?? false,
      isEmailVerified: true,
      language: 'en',
      theme: 'system',
    });
    users.seed(user);
    return user;
  };

  beforeEach(() => {
    sessions = new MockUserSessionRepository();
    users = new MockUserRepository();
    const sign = new SignAccessToken(new FakeTokenService(), policy.accessTokenTtl);
    start = new StartUserSession(sessions, new FakeIdGenerator(), sign, policy);
    refresh = new RefreshUserSession(sessions, users, sign, policy);
  });

  describe('StartUserSession', () => {
    it('stores only the hash of the refresh token and ties the access token to the session', async () => {
      const user = seedUser();

      const tokens = await start.execute({ user, rememberMe: false, now: t0 });

      expect(sessions.sessions).toHaveLength(1);
      const session = sessions.sessions[0];
      expect(session.tokenHash).toBe(SessionSecret.hash(tokens.refreshToken));
      expect(session.tokenHash).not.toBe(tokens.refreshToken);
      expect(claims(tokens.accessToken)).toMatchObject({ sub: 'user-1', sid: session.getId(), expiresIn: '15m' });
    });

    it('lasts a day without "keep me signed in" and thirty days with it', async () => {
      const user = seedUser();

      await start.execute({ user, rememberMe: false, now: t0 });
      await start.execute({ user, rememberMe: true, now: t0 });

      expect(sessions.sessions[0].expiresAt).toEqual(at(DAY));
      expect(sessions.sessions[1].expiresAt).toEqual(at(30 * DAY));
    });
  });

  describe('RefreshUserSession', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      const user = seedUser();
      const first = await start.execute({ user, rememberMe: false, now: t0 });

      const second = await refresh.execute({ refreshToken: first.refreshToken, now: at(20 * MINUTE) });

      expect(second.refreshToken).not.toBeNull();
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(claims(second.accessToken).sid).toBe(sessions.sessions[0].getId());
      await expect(refresh.execute({ refreshToken: second.refreshToken!, now: at(40 * MINUTE) })).resolves.toBeDefined();
    });

    it('reads claims from the user as they are now', async () => {
      const user = seedUser({ isSystemAdmin: true });
      const first = await start.execute({ user, rememberMe: false, now: t0 });
      user.isSystemAdmin = false;

      const second = await refresh.execute({ refreshToken: first.refreshToken, now: at(MINUTE) });

      expect(claims(second.accessToken).isSystemAdmin).toBe(false);
    });

    it('keeps the fixed end of a session that is not remembered', async () => {
      const user = seedUser();
      const first = await start.execute({ user, rememberMe: false, now: t0 });

      await refresh.execute({ refreshToken: first.refreshToken, now: at(20 * HOUR) });

      expect(sessions.sessions[0].expiresAt).toEqual(at(DAY));
    });

    it('extends a remembered session on every use', async () => {
      const user = seedUser();
      const first = await start.execute({ user, rememberMe: true, now: t0 });

      await refresh.execute({ refreshToken: first.refreshToken, now: at(10 * DAY) });

      expect(sessions.sessions[0].expiresAt).toEqual(at(40 * DAY));
    });

    it('rejects an expired session', async () => {
      const user = seedUser();
      const first = await start.execute({ user, rememberMe: false, now: t0 });

      await expect(refresh.execute({ refreshToken: first.refreshToken, now: at(DAY + MINUTE) }))
        .rejects.toThrow(InvalidCredentialsError);
    });

    it('rejects a deactivated user', async () => {
      const user = seedUser();
      const first = await start.execute({ user, rememberMe: true, now: t0 });
      user.isActive = false;

      await expect(refresh.execute({ refreshToken: first.refreshToken, now: at(MINUTE) }))
        .rejects.toThrow(InvalidCredentialsError);
    });

    it('rejects a token it never issued', async () => {
      await expect(refresh.execute({ refreshToken: 'made-up', now: t0 })).rejects.toThrow(InvalidCredentialsError);
    });

    it('answers a second tab racing with the old token with an access token only', async () => {
      const user = seedUser();
      const first = await start.execute({ user, rememberMe: false, now: t0 });
      await refresh.execute({ refreshToken: first.refreshToken, now: at(20 * MINUTE) });

      const racing = await refresh.execute({ refreshToken: first.refreshToken, now: at(20 * MINUTE + 10 * 1000) });

      expect(racing.refreshToken).toBeNull();
      expect(sessions.sessions[0].revokedAt).toBeNull();
    });

    it('gives only an access token to the refresh that loses a rotation race', async () => {
      const user = seedUser();
      const first = await start.execute({ user, rememberMe: false, now: t0 });
      // Another request rotates the same token between this one reading and writing it
      const rotate = sessions.rotate.bind(sessions);
      sessions.rotate = async (id, expected, rotation) => {
        await rotate(id, expected, { ...rotation, tokenHash: 'rotated-by-the-other-request' });
        return rotate(id, expected, rotation);
      };

      const loser = await refresh.execute({ refreshToken: first.refreshToken, now: at(MINUTE) });

      expect(loser.refreshToken).toBeNull();
      expect(sessions.sessions[0].tokenHash).toBe('rotated-by-the-other-request');
      expect(sessions.sessions[0].revokedAt).toBeNull();
    });

    it('revokes the session when an old token comes back after the grace window', async () => {
      const user = seedUser();
      const first = await start.execute({ user, rememberMe: false, now: t0 });
      const second = await refresh.execute({ refreshToken: first.refreshToken, now: at(20 * MINUTE) });

      await expect(refresh.execute({ refreshToken: first.refreshToken, now: at(25 * MINUTE) }))
        .rejects.toThrow(InvalidCredentialsError);

      expect(sessions.sessions[0].revokedAt).toEqual(at(25 * MINUTE));
      await expect(refresh.execute({ refreshToken: second.refreshToken!, now: at(26 * MINUTE) }))
        .rejects.toThrow(InvalidCredentialsError);
    });
  });

  describe('EndUserSession', () => {
    it('revokes the session so its token no longer refreshes', async () => {
      const user = seedUser();
      const first = await start.execute({ user, rememberMe: true, now: t0 });

      await new EndUserSession(sessions).execute({ refreshToken: first.refreshToken, now: at(MINUTE) });

      await expect(refresh.execute({ refreshToken: first.refreshToken, now: at(2 * MINUTE) }))
        .rejects.toThrow(InvalidCredentialsError);
    });

    it('succeeds silently for a token it does not know', async () => {
      await expect(new EndUserSession(sessions).execute({ refreshToken: 'made-up' })).resolves.toBeUndefined();
    });
  });

  describe('RevokeUserSessions', () => {
    it('signs the user out everywhere except the session it keeps', async () => {
      const user = seedUser();
      const kept = await start.execute({ user, rememberMe: true, now: t0 });
      const other = await start.execute({ user, rememberMe: true, now: t0 });
      const keptId = claims(kept.accessToken).sid;

      await new RevokeUserSessions(sessions).execute({ userId: 'user-1', exceptSessionId: keptId, now: at(MINUTE) });

      await expect(refresh.execute({ refreshToken: kept.refreshToken, now: at(2 * MINUTE) })).resolves.toBeDefined();
      await expect(refresh.execute({ refreshToken: other.refreshToken, now: at(2 * MINUTE) }))
        .rejects.toThrow(InvalidCredentialsError);
    });
  });

  describe('PurgeStaleSessions', () => {
    it('deletes sessions dead for over a week and keeps the rest', async () => {
      const user = seedUser();
      await start.execute({ user, rememberMe: false, now: t0 });
      const recent = await start.execute({ user, rememberMe: false, now: at(7 * DAY) });
      await new EndUserSession(sessions).execute({ refreshToken: recent.refreshToken, now: at(7 * DAY) });

      const deleted = await new PurgeStaleSessions(sessions).execute({ now: at(9 * DAY) });

      expect(deleted).toBe(1);
      expect(sessions.sessions).toHaveLength(1);
      expect(sessions.sessions[0].revokedAt).toEqual(at(7 * DAY));
    });
  });
});
