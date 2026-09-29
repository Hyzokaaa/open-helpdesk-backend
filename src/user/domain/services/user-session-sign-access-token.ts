import { TokenService } from '../../../shared/domain/token-service';
import { User } from '../entities/user';

interface SignAccessTokenProps {
  user: User;
  sessionId: string;
}

/**
 * Signs the short-lived access token of a session. Claims are read from the user as it is now,
 * so a refresh picks up changes such as a revoked system-admin flag or a verified email.
 */
export class SignAccessToken {
  constructor(
    private readonly tokenService: TokenService,
    private readonly expiresIn: string,
  ) {}

  async execute(props: SignAccessTokenProps): Promise<string> {
    return this.tokenService.sign(
      {
        sub: props.user.getId(),
        email: props.user.email,
        isSystemAdmin: props.user.isSystemAdmin,
        isEmailVerified: props.user.isEmailVerified,
        sid: props.sessionId,
      },
      { expiresIn: this.expiresIn },
    );
  }
}
