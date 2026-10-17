import { createHash, randomBytes } from 'crypto';
import { User } from '../../../../src/user/domain/entities/user';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { SessionPolicy, StartUserSession } from '../../../../src/user/domain/services/user-session-start';
import { SignAccessToken } from '../../../../src/user/domain/services/user-session-sign-access-token';
import { RefreshUserSession } from '../../../../src/user/domain/services/user-session-refresh';
import { EndUserSession } from '../../../../src/user/domain/services/user-session-end';
import { ConsumeOneTimeToken } from '../../../../src/user/domain/services/user-token-consume';
import { ResolveHandoffAudience } from '../../../../src/user/domain/services/user-session-handoff-audience';
import { IssueSessionHandoff } from '../../../../src/user/domain/services/user-session-handoff-issue';
import { ExchangeSessionHandoff } from '../../../../src/user/domain/services/user-session-handoff-exchange';
import { StartSessionHandoff } from '../../../../src/user/domain/services/user-session-handoff-start';
import { AccessDeniedError, DomainValidationError, InvalidCredentialsError } from '../../../../src/shared/domain/errors';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockUserSessionRepository } from '../../../mocks/mock-user-session.repository';
import { MockUsedTokenRepository } from '../../../mocks/mock-used-token.repository';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakeTokenService } from '../../../mocks/fake-token-service';

const DAY = 24 * 60 * 60 * 1000;
const policy: SessionPolicy = { accessTokenTtl: '15m', sessionTtlMs: DAY, rememberedSessionTtlMs: 30 * DAY, rotationGraceMs: 30 * 1000 };

const INSTALLATION = 'https://app.helpdesk.test';
const ACME = 'https://soporte.acme.test';
const INITECH = 'https://desk.initech.test';

/** A PKCE pair, as the receiving page generates it. */
function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

describe('session handoff between addresses of the installation', () => {
  let sessions: MockUserSessionRepository;
  let users: MockUserRepository;
  let workspaces: MockWorkspaceRepository;
  let members: MockWorkspaceMemberRepository;
  let start: StartUserSession;
  let issue: IssueSessionHandoff;
  let exchange: ExchangeSessionHandoff;
  let audiences: ResolveHandoffAudience;
  const tokens = new FakeTokenService();

  const seedUser = (id = 'user-1') => {
    const user = new User({
      id, email: `${id}@example.com`, password: 'hashed:x', firstName: 'Luis', lastName: 'M',
      isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'es', theme: 'system',
    });
    users.seed(user);
    return user;
  };
  const sidOf = (accessToken: string) => (JSON.parse(accessToken) as { sid: string }).sid;
  const signIn = async (user: User, rememberMe = true) => sidOf((await start.execute({ user, rememberMe })).accessToken);
  const handOver = async (sessionId: string, to: string) => {
    const { verifier, challenge } = pkce();
    const code = await issue.execute({ userId: 'user-1', sessionId, audience: to, codeChallenge: challenge });
    return exchange.execute({ code, codeVerifier: verifier, origin: to });
  };

  beforeEach(() => {
    sessions = new MockUserSessionRepository();
    users = new MockUserRepository();
    workspaces = new MockWorkspaceRepository();
    members = new MockWorkspaceMemberRepository();
    const sign = new SignAccessToken(tokens, policy.accessTokenTtl);
    start = new StartUserSession(sessions, new FakeIdGenerator('session'), sign, policy);
    audiences = new ResolveHandoffAudience(workspaces, INSTALLATION);
    issue = new IssueSessionHandoff(tokens, sessions, audiences);
    exchange = new ExchangeSessionHandoff(new ConsumeOneTimeToken(tokens, new MockUsedTokenRepository()), sessions, users, members, audiences, start);

    workspaces.seed(new Workspace({ id: 'ws-acme', name: 'Acme', slug: 'acme', description: '', customDomain: 'soporte.acme.test', customDomainVerified: true }));
    workspaces.seed(new Workspace({ id: 'ws-initech', name: 'Initech', slug: 'initech', description: '', customDomain: 'desk.initech.test', customDomainVerified: true }));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-acme', userId: 'user-1', role: WorkspaceRole.AGENT }));
  });

  it('opens a session on a custom domain of a workspace the user belongs to', async () => {
    const root = await signIn(seedUser());

    const result = await handOver(root, ACME);

    const handed = await sessions.findById(sidOf(result.tokens.accessToken));
    expect(handed?.rootSessionId).toBe(root);
    expect(result.to).toBe(ACME);
  });

  it('carries the session to the installation address and back, in one family', async () => {
    const onAcme = await signIn(seedUser());
    const onInstallation = sidOf((await handOver(onAcme, INSTALLATION)).tokens.accessToken);
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-initech', userId: 'user-1', role: WorkspaceRole.AGENT }));

    const onInitech = sidOf((await handOver(onInstallation, INITECH)).tokens.accessToken);

    expect((await sessions.findById(onInitech))?.rootSessionId).toBe(onAcme);
  });

  it('gives the handed-over session the lifetime of the one it comes from', async () => {
    const root = await signIn(seedUser());

    const handed = await sessions.findById(sidOf((await handOver(root, ACME)).tokens.accessToken));

    const original = await sessions.findById(root);
    expect(handed?.rememberMe).toBe(true);
    expect(handed?.expiresAt).toEqual(original?.expiresAt);
  });

  it('does not carry a session that must end with the browser', async () => {
    const root = await signIn(seedUser(), false);

    await expect(issue.execute({ userId: 'user-1', sessionId: root, audience: ACME, codeChallenge: pkce().challenge }))
      .rejects.toThrow(DomainValidationError);
  });

  it('refuses a domain whose workspaces the user does not belong to', async () => {
    const root = await signIn(seedUser());

    await expect(handOver(root, INITECH)).rejects.toThrow(AccessDeniedError);
  });

  it('refuses to issue a code for an address outside the installation', async () => {
    const root = await signIn(seedUser());

    for (const to of ['https://evil.test', 'http://soporte.acme.test', 'https://soporte.acme.test:8443', 'https://soporte.acme.test/path']) {
      await expect(issue.execute({ userId: 'user-1', sessionId: root, audience: to, codeChallenge: pkce().challenge }))
        .rejects.toThrow(DomainValidationError);
    }
  });

  it('refuses an unverified domain and one that kept failing the daily check', async () => {
    const root = await signIn(seedUser());
    const acme = (await workspaces.findById('ws-acme'))!;

    acme.customDomainCheckFailures = 3;
    await expect(issue.execute({ userId: 'user-1', sessionId: root, audience: ACME, codeChallenge: pkce().challenge }))
      .rejects.toThrow(DomainValidationError);

    acme.customDomainCheckFailures = 0;
    acme.customDomainVerified = false;
    await expect(issue.execute({ userId: 'user-1', sessionId: root, audience: ACME, codeChallenge: pkce().challenge }))
      .rejects.toThrow(DomainValidationError);
  });

  it('accepts a code once, only from its own origin and only with the receiver secret', async () => {
    const root = await signIn(seedUser());
    const { verifier, challenge } = pkce();
    const code = () => issue.execute({ userId: 'user-1', sessionId: root, audience: ACME, codeChallenge: challenge });

    await expect(exchange.execute({ code: await code(), codeVerifier: verifier, origin: INITECH })).rejects.toThrow(InvalidCredentialsError);
    await expect(exchange.execute({ code: await code(), codeVerifier: pkce().verifier, origin: ACME })).rejects.toThrow(InvalidCredentialsError);

    const once = await code();
    await expect(exchange.execute({ code: once, codeVerifier: verifier, origin: ACME })).resolves.toBeDefined();
    await expect(exchange.execute({ code: once, codeVerifier: verifier, origin: ACME })).rejects.toThrow(InvalidCredentialsError);
  });

  it('does not hand over a session that was signed out meanwhile', async () => {
    const root = await signIn(seedUser());
    const { verifier, challenge } = pkce();
    const code = await issue.execute({ userId: 'user-1', sessionId: root, audience: ACME, codeChallenge: challenge });

    await sessions.revokeFamily(root, new Date());

    await expect(exchange.execute({ code, codeVerifier: verifier, origin: ACME })).rejects.toThrow(InvalidCredentialsError);
  });

  it('cannot hand over a token without a session, such as one from the API token exchange', async () => {
    seedUser();

    await expect(issue.execute({ userId: 'user-1', audience: ACME, codeChallenge: pkce().challenge }))
      .rejects.toThrow(InvalidCredentialsError);
  });

  it('signs the browser out of every address at once', async () => {
    const user = seedUser();
    const tokensOnAcme = await start.execute({ user, rememberMe: true });
    const root = sidOf(tokensOnAcme.accessToken);
    const handed = sidOf((await handOver(root, INSTALLATION)).tokens.accessToken);
    const elsewhere = await signIn(user);

    await new EndUserSession(sessions).execute({ refreshToken: tokensOnAcme.refreshToken });

    expect((await sessions.findById(root))?.revokedAt).not.toBeNull();
    expect((await sessions.findById(handed))?.revokedAt).not.toBeNull();
    // Another browser, signed in on its own, stays signed in
    expect((await sessions.findById(elsewhere))?.revokedAt).toBeNull();
  });

  describe('the installation answering a custom domain in one call', () => {
    const startOn = () => new StartSessionHandoff(sessions, audiences, issue);

    it('gives a code from the refresh token kept on the installation, even once its access token expired', async () => {
      const user = seedUser();
      const kept = await start.execute({ user, rememberMe: true });
      const { verifier, challenge } = pkce();

      const result = await startOn().execute({ audience: ACME, codeChallenge: challenge, refreshToken: kept.refreshToken });

      expect(result).toHaveProperty('code');
      const exchanged = await exchange.execute({ code: (result as { code: string }).code, codeVerifier: verifier, origin: ACME });
      expect((await sessions.findById(sidOf(exchanged.tokens.accessToken)))?.rootSessionId).toBe(sidOf(kept.accessToken));
    });

    it('asks to sign in without a session, with a revoked one or one that ends with the browser', async () => {
      const user = seedUser();
      const notKept = await start.execute({ user, rememberMe: false });
      const revoked = await start.execute({ user, rememberMe: true });
      await sessions.revokeFamily(sidOf(revoked.accessToken), new Date());

      for (const refreshToken of [null, 'not-a-token', notKept.refreshToken, revoked.refreshToken]) {
        await expect(startOn().execute({ audience: ACME, codeChallenge: pkce().challenge, refreshToken }))
          .resolves.toEqual({ loginRequired: true });
      }
    });

    it('refuses an address outside the installation, with or without a session', async () => {
      const kept = await start.execute({ user: seedUser(), rememberMe: true });

      await expect(startOn().execute({ audience: 'https://evil.test', codeChallenge: pkce().challenge, refreshToken: kept.refreshToken }))
        .rejects.toThrow(DomainValidationError);
      await expect(startOn().execute({ audience: 'https://evil.test', codeChallenge: pkce().challenge }))
        .rejects.toThrow(DomainValidationError);
    });
  });

  it('keeps the whole family alive while the user works on any address', async () => {
    const user = seedUser();
    const root = await signIn(user);
    const handed = await handOver(root, ACME);
    const later = new Date(Date.now() + 20 * DAY);

    await new RefreshUserSession(sessions, users, new SignAccessToken(tokens, '15m'), policy)
      .execute({ refreshToken: handed.tokens.refreshToken, now: later });

    const expected = new Date(later.getTime() + 30 * DAY);
    expect((await sessions.findById(root))?.expiresAt).toEqual(expected);
  });
});
