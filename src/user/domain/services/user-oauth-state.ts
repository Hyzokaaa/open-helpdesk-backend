import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { TokenService } from '../../../shared/domain/token-service';
import { ConsumeOneTimeToken, newTokenId } from './user-token-consume';

export const OAUTH_STATE_TYPE = 'oauth-state';
/** How long the person has to complete the provider's sign-in page. */
export const OAUTH_STATE_TTL_SECONDS = 600;

interface IssueOAuthStateProps {
  /** Frontend to return to; still checked against the allowed origins on the way back. */
  redirect?: string | null;
}

export interface IssuedOAuthState {
  /** Sent to the provider and echoed back on the callback. */
  state: string;
  /** Kept by the browser that started the sign-in (an httpOnly cookie); never sent to the provider. */
  browserNonce: string;
}

function hashNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('base64url');
}

/**
 * Starts a provider sign-in. The state is signed, short-lived, single-use and bound to the
 * browser through the nonce, so a callback URL produced in someone else's browser (login CSRF:
 * signing the victim into the attacker's account) is refused.
 */
export class IssueOAuthState {
  constructor(private readonly tokenService: TokenService) {}

  execute(props: IssueOAuthStateProps): IssuedOAuthState {
    const browserNonce = randomBytes(32).toString('base64url');
    const state = this.tokenService.sign(
      { type: OAUTH_STATE_TYPE, jti: newTokenId(), nonce: hashNonce(browserNonce), redirect: props.redirect ?? null },
      { expiresIn: `${OAUTH_STATE_TTL_SECONDS}s` },
    );
    return { state, browserNonce };
  }
}

interface VerifyOAuthStateProps {
  state: string | undefined | null;
  browserNonce: string | undefined | null;
}

export class VerifyOAuthState {
  constructor(private readonly consumeToken: ConsumeOneTimeToken) {}

  /** The redirect asked for at the start; null when the state is not valid for this browser. */
  async execute(props: VerifyOAuthStateProps): Promise<{ redirect: string | null } | null> {
    if (!props.state || !props.browserNonce) return null;

    const payload = await this.consumeToken.execute({ token: props.state, type: OAUTH_STATE_TYPE });
    if (!payload || typeof payload.nonce !== 'string') return null;

    const expected = Buffer.from(payload.nonce);
    const actual = Buffer.from(hashNonce(props.browserNonce));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    return { redirect: typeof payload.redirect === 'string' ? payload.redirect : null };
  }
}
