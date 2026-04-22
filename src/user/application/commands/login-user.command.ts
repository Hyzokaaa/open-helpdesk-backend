import { TokenService } from '../../../shared/domain/token-service';
import { Command } from '../../../shared/domain/command';
import { AuthenticateUser } from '../../domain/services/user-authenticate';

interface Props {
  email: string;
  password: string;
}

export interface LoginUserResponse {
  accessToken: string;
}

export class LoginUserCommand implements Command<Props, LoginUserResponse> {
  constructor(
    private readonly authenticateUser: AuthenticateUser,
    private readonly tokenService: TokenService,
  ) {}

  async execute(props: Props): Promise<LoginUserResponse> {
    const user = await this.authenticateUser.execute({
      email: props.email,
      password: props.password,
    });

    const payload = { sub: user.getId(), email: user.email, isSystemAdmin: user.isSystemAdmin };
    const accessToken = this.tokenService.sign(payload);

    return { accessToken };
  }
}
