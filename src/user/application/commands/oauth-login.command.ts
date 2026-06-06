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
  accessToken: string;
}

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

    const payload = {
      sub: user.getId(),
      email: user.email,
      isSystemAdmin: user.isSystemAdmin,
      isEmailVerified: user.isEmailVerified,
    };
    const accessToken = this.tokenService.sign(payload);

    return { accessToken };
  }
}
