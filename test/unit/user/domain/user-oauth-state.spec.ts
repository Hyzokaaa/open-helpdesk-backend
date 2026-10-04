import { IssueOAuthState, VerifyOAuthState } from '../../../../src/user/domain/services/user-oauth-state';
import { ConsumeOneTimeToken } from '../../../../src/user/domain/services/user-token-consume';
import { TokenService } from '../../../../src/shared/domain/token-service';
import { MockUsedTokenRepository } from '../../../mocks/mock-used-token.repository';

const encode = (payload: Record<string, unknown>) => Buffer.from(JSON.stringify(payload)).toString('base64url');

/** Accepts only what it signed itself, as a real JWT service would. */
class FakeTokenService implements TokenService {
  private readonly issued = new Set<string>();

  sign(payload: Record<string, unknown>): string {
    const token = encode({ ...payload, exp: Math.floor(Date.now() / 1000) + 600 });
    this.issued.add(token);
    return token;
  }

  verify<T>(token: string): T {
    if (!this.issued.has(token)) throw new Error('invalid signature');
    return JSON.parse(Buffer.from(token, 'base64url').toString()) as T;
  }
}

describe('OAuth state', () => {
  let tokens: FakeTokenService;
  let issue: IssueOAuthState;
  let verify: VerifyOAuthState;

  beforeEach(() => {
    tokens = new FakeTokenService();
    issue = new IssueOAuthState(tokens);
    verify = new VerifyOAuthState(new ConsumeOneTimeToken(tokens, new MockUsedTokenRepository()));
  });

  it('accepts the callback in the browser that started the sign-in, and keeps the requested redirect', async () => {
    const started = issue.execute({ redirect: 'https://help.acme.com' });

    const result = await verify.execute({ state: started.state, browserNonce: started.browserNonce });

    expect(result).toEqual({ redirect: 'https://help.acme.com' });
  });

  it('refuses a callback carried to another browser (login CSRF into the attacker account)', async () => {
    const attacker = issue.execute({});
    const victim = issue.execute({});

    expect(await verify.execute({ state: attacker.state, browserNonce: victim.browserNonce })).toBeNull();
    expect(await verify.execute({ state: attacker.state, browserNonce: null })).toBeNull();
  });

  it('refuses a state it did not sign, such as the bare redirect URL accepted before', async () => {
    const started = issue.execute({});

    expect(await verify.execute({ state: 'https://help.acme.com', browserNonce: started.browserNonce })).toBeNull();
    expect(await verify.execute({ state: undefined, browserNonce: started.browserNonce })).toBeNull();
  });

  it('accepts a state once', async () => {
    const started = issue.execute({});

    await verify.execute({ state: started.state, browserNonce: started.browserNonce });

    expect(await verify.execute({ state: started.state, browserNonce: started.browserNonce })).toBeNull();
  });
});
