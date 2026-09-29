import { TokenService } from '../../../shared/domain/token-service';
import { Command } from '../../../shared/domain/command';
import { InvalidCredentialsError } from '../../../shared/domain/errors';
import { ResetPassword } from '../../domain/services/user-reset-password';
import { RevokeUserSessions } from '../../domain/services/user-sessions-revoke';

interface Props {
  token: string;
  newPassword: string;
}

export class ResetPasswordCommand implements Command<Props, void> {
  constructor(
    private readonly resetPassword: ResetPassword,
    private readonly tokenService: TokenService,
    private readonly revokeSessions?: RevokeUserSessions,
  ) {}

  async execute(props: Props): Promise<void> {
    let payload: { sub: string; type: string };
    try {
      payload = this.tokenService.verify(props.token);
    } catch {
      throw new InvalidCredentialsError('Invalid or expired reset token');
    }

    if (payload.type !== 'password-reset') {
      throw new InvalidCredentialsError('Invalid reset token');
    }

    await this.resetPassword.execute({
      userId: payload.sub,
      newPassword: props.newPassword,
    });
    // A reset usually means the password leaked: sign the user out everywhere
    await this.revokeSessions?.execute({ userId: payload.sub });
  }
}
