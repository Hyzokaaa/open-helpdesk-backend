import { createHash, timingSafeEqual } from 'crypto';
import { AccessDeniedError, InvalidCredentialsError } from '../../../shared/domain/errors';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { UserRepository } from '../repositories/user.repository';
import { UserSessionRepository } from '../repositories/user-session.repository';
import { ResolveHandoffAudience } from './user-session-handoff-audience';
import { SESSION_HANDOFF_TYPE } from './user-session-handoff-issue';
import { SessionTokens, StartUserSession } from './user-session-start';
import { ConsumeOneTimeToken } from './user-token-consume';

/** PKCE secrets are 43 to 128 characters (RFC 7636). */
const CODE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

interface ExchangeSessionHandoffProps {
  code: string;
  codeVerifier: string;
  /** Origin of the request, as the browser sent it. */
  origin: string;
  now?: Date;
}

export interface SessionHandoffResult {
  tokens: SessionTokens;
  userId: string;
  from: string | null;
  to: string;
}

/**
 * Trades a handoff code for a session of the receiving address. The code works once, only from
 * the origin it was issued for and only with the receiver's secret. The new session joins the
 * family of the one it comes from, so it lasts and ends with it. On a custom domain the user
 * must belong to one of its workspaces.
 */
export class ExchangeSessionHandoff {
  constructor(
    private readonly consumeToken: ConsumeOneTimeToken,
    private readonly sessionRepository: UserSessionRepository,
    private readonly userRepository: UserRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly resolveAudience: ResolveHandoffAudience,
    private readonly startSession: StartUserSession,
  ) {}

  async execute(props: ExchangeSessionHandoffProps): Promise<SessionHandoffResult> {
    const now = props.now ?? new Date();
    const invalid = new InvalidCredentialsError('Invalid or expired sign-in code');

    const payload = await this.consumeToken.execute({ token: props.code, type: SESSION_HANDOFF_TYPE });
    if (!payload?.sub || typeof payload.sid !== 'string' || typeof payload.cc !== 'string') throw invalid;
    if (payload.aud !== props.origin) throw invalid;
    if (!CODE_VERIFIER.test(props.codeVerifier) || !matchesChallenge(props.codeVerifier, payload.cc)) throw invalid;

    const from = await this.sessionRepository.findById(payload.sid);
    if (!from || from.userId !== payload.sub || from.revokedAt || from.expiresAt <= now) throw invalid;
    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) throw invalid;

    const audience = await this.resolveAudience.execute(props.origin);
    if (!audience) throw invalid;
    if (audience.kind === 'custom-domain' && !user.isSystemAdmin) {
      const memberships = await this.memberRepository.findByUserId(user.getId());
      if (!memberships.some((m) => audience.workspaceIds.includes(m.workspaceId))) {
        throw new AccessDeniedError('Your account has no access to this address');
      }
    }

    const tokens = await this.startSession.execute({ user, rememberMe: from.rememberMe, handedOverFrom: from, now });
    return {
      tokens,
      userId: user.getId(),
      from: typeof payload.from === 'string' ? payload.from : null,
      to: props.origin,
    };
  }
}

function matchesChallenge(verifier: string, challenge: string): boolean {
  const computed = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}
