import { TokenService } from '../../../shared/domain/token-service';
import { Command } from '../../../shared/domain/command';
import { InvalidCredentialsError } from '../../../shared/domain/errors';
import { UserRepository } from '../../domain/repositories/user.repository';
import { StartUserSession } from '../../domain/services/user-session-start';
import { OAUTH_CODE_TYPE } from './oauth-login.command';

interface Props {
  code: string;
  rememberMe: boolean;
}

export interface ExchangeOAuthCodeResponse {
  accessToken: string;
  refreshToken: string;
}

export class ExchangeOAuthCodeCommand implements Command<Props, ExchangeOAuthCodeResponse> {
  constructor(
    private readonly tokenService: TokenService,
    private readonly userRepository: UserRepository,
    private readonly startSession: StartUserSession,
  ) {}

  async execute(props: Props): Promise<ExchangeOAuthCodeResponse> {
    let payload: { sub: string; type?: string };
    try {
      payload = this.tokenService.verify(props.code);
    } catch {
      throw new InvalidCredentialsError('Invalid or expired sign-in code');
    }
    if (payload.type !== OAUTH_CODE_TYPE) throw new InvalidCredentialsError('Invalid sign-in code');

    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) throw new InvalidCredentialsError('Invalid sign-in code');

    const tokens = await this.startSession.execute({ user, rememberMe: props.rememberMe });
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }
}
