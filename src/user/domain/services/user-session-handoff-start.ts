import { DomainValidationError } from '../../../shared/domain/errors';
import { UserSessionRepository } from '../repositories/user-session.repository';
import { ResolveHandoffAudience } from './user-session-handoff-audience';
import { IssueSessionHandoff } from './user-session-handoff-issue';
import { SessionSecret } from './user-session-secret';

interface StartSessionHandoffProps {
  /** Origin asking for the session, e.g. https://help.example.com. */
  audience: string;
  codeChallenge: string;
  /** The refresh token the installation's address keeps, if it has one. */
  refreshToken?: string | null;
  fromOrigin?: string | null;
  now?: Date;
}

export type StartSessionHandoffResult = { code: string } | { loginRequired: true };

/**
 * The installation's address answering a custom domain in one call: a handoff code when the
 * browser holds a live session kept signed in there, or "sign in" otherwise. It reads the session
 * by its refresh token, which outlives the access token, so a visit hours later needs no renewal
 * first. The audience is checked either way: nobody is sent back to an address outside the
 * installation.
 */
export class StartSessionHandoff {
  constructor(
    private readonly sessionRepository: UserSessionRepository,
    private readonly resolveAudience: ResolveHandoffAudience,
    private readonly issueHandoff: IssueSessionHandoff,
  ) {}

  async execute(props: StartSessionHandoffProps): Promise<StartSessionHandoffResult> {
    const now = props.now ?? new Date();
    if (!(await this.resolveAudience.execute(props.audience))) {
      throw new DomainValidationError('This address does not belong to the installation');
    }
    if (!props.refreshToken) return { loginRequired: true };

    const hash = SessionSecret.hash(props.refreshToken);
    const session = await this.sessionRepository.findByTokenHash(hash)
      ?? await this.sessionRepository.findByPreviousTokenHash(hash);
    if (!session || session.revokedAt || session.expiresAt <= now || !session.rememberMe) return { loginRequired: true };

    const code = await this.issueHandoff.execute({
      userId: session.userId,
      sessionId: session.getId(),
      audience: props.audience,
      codeChallenge: props.codeChallenge,
      fromOrigin: props.fromOrigin,
      now,
    });
    return { code };
  }
}
