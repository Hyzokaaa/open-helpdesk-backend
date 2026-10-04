import { randomBytes } from 'crypto';
import { TokenService } from '../../../shared/domain/token-service';
import { UsedTokenRepository } from '../repositories/used-token.repository';

interface ConsumeOneTimeTokenProps {
  token: string;
  /** The `type` claim the token must carry, e.g. 'password-reset'. */
  type: string;
}

export interface OneTimeTokenPayload {
  sub: string;
  type: string;
  jti: string;
  exp: number;
  [claim: string]: unknown;
}

/** Fallback lifetime for the used-id record if a token somehow carries no `exp`. */
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Accepts a single-purpose token once. Signing it with a `jti` (see `newTokenId`) is what makes
 * it single-use: the id is recorded as spent on first use and every later use is refused.
 */
export class ConsumeOneTimeToken {
  constructor(
    private readonly tokenService: TokenService,
    private readonly usedTokens: UsedTokenRepository,
  ) {}

  /** The payload on first use; null when the token is invalid, expired, of another type or already spent. */
  async execute(props: ConsumeOneTimeTokenProps): Promise<OneTimeTokenPayload | null> {
    let payload: Partial<OneTimeTokenPayload>;
    try {
      payload = this.tokenService.verify<Partial<OneTimeTokenPayload>>(props.token);
    } catch {
      return null;
    }
    if (payload.type !== props.type || !payload.sub || typeof payload.jti !== 'string' || !payload.jti) {
      return null;
    }

    const expiresAt = typeof payload.exp === 'number'
      ? new Date(payload.exp * 1000)
      : new Date(Date.now() + DEFAULT_RETENTION_MS);
    const first = await this.usedTokens.markUsed(`${props.type}:${payload.jti}`, expiresAt);
    return first ? (payload as OneTimeTokenPayload) : null;
  }
}

/** A fresh id for the `jti` claim of a single-use token. */
export function newTokenId(): string {
  return randomBytes(16).toString('base64url');
}
