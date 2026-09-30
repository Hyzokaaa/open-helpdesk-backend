import { TokenService } from '../../../shared/domain/token-service';
import { Command } from '../../../shared/domain/command';
import { AuthenticateOAuth } from '../../domain/services/user-authenticate-oauth';

interface Props {
  email: string;
  firstName: string;
  lastName: string;
  authProvider: string;
}

export interface OAuthLoginResponse {
  /** One-minute code the client trades for a session; it travels in the redirect URL. */
  code: string;
}

export const OAUTH_CODE_TYPE = 'oauth-code';

export class OAuthLoginCommand implements Command<Props, OAuthLoginResponse> {
  constructor(
    private readonly authenticateOAuth: AuthenticateOAuth,
    private readonly tokenService: TokenService,
  ) {}

  async execute(props: Props): Promise<OAuthLoginResponse> {
    const user = await this.authenticateOAuth.execute({
      email: props.email,
      firstName: props.firstName,
      lastName: props.lastName,
      authProvider: props.authProvider,
    });

    // The redirect URL ends up in browser history and logs, so it carries a short-lived code
    // instead of the session tokens themselves.
    const code = this.tokenService.sign({ sub: user.getId(), type: OAUTH_CODE_TYPE }, { expiresIn: '60s' });
    return { code };
  }
}
