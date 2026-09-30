import { Command } from '../../../shared/domain/command';
import { AuthenticateUser } from '../../domain/services/user-authenticate';
import { StartUserSession } from '../../domain/services/user-session-start';

interface Props {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginUserResponse {
  accessToken: string;
  refreshToken: string;
}

export class LoginUserCommand implements Command<Props, LoginUserResponse> {
  constructor(
    private readonly authenticateUser: AuthenticateUser,
    private readonly startSession: StartUserSession,
  ) {}

  async execute(props: Props): Promise<LoginUserResponse> {
    const user = await this.authenticateUser.execute({
      email: props.email,
      password: props.password,
    });

    const tokens = await this.startSession.execute({ user, rememberMe: props.rememberMe });
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }
}
