import { Command } from '../../../shared/domain/command';
import { TokenService } from '../../../shared/domain/token-service';
import { InvalidCredentialsError } from '../../../shared/domain/errors';
import { VerifyEmail } from '../../domain/services/user-verify-email';

interface Props {
  token: string;
}

export class VerifyEmailCommand implements Command<Props, void> {
  constructor(
    private readonly verifyEmail: VerifyEmail,
    private readonly tokenService: TokenService,
  ) {}

  async execute(props: Props): Promise<void> {
    let payload: { sub: string; type: string };
    try {
      payload = this.tokenService.verify<{ sub: string; type: string }>(props.token);
    } catch {
      throw new InvalidCredentialsError('Invalid or expired verification token');
    }

    if (payload.type !== 'email-verification') {
      throw new InvalidCredentialsError('Invalid verification token');
    }

    await this.verifyEmail.execute({ userId: payload.sub });
  }
}
