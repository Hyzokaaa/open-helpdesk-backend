import { Command } from '../../../shared/domain/command';
import { InvalidCredentialsError } from '../../../shared/domain/errors';
import { ResetPassword } from '../../domain/services/user-reset-password';
import { RevokeUserSessions } from '../../domain/services/user-sessions-revoke';
import { ConsumeOneTimeToken } from '../../domain/services/user-token-consume';

interface Props {
  token: string;
  newPassword: string;
}

export const PASSWORD_RESET_TYPE = 'password-reset';

export class ResetPasswordCommand implements Command<Props, void> {
  constructor(
    private readonly resetPassword: ResetPassword,
    private readonly consumeToken: ConsumeOneTimeToken,
    private readonly revokeSessions?: RevokeUserSessions,
  ) {}

  async execute(props: Props): Promise<void> {
    // A reset link sets the password once: a copy found later in a mailbox or a log is useless
    const payload = await this.consumeToken.execute({ token: props.token, type: PASSWORD_RESET_TYPE });
    if (!payload?.sub) throw new InvalidCredentialsError('Invalid, expired or already used reset token');

    await this.resetPassword.execute({
      userId: payload.sub,
      newPassword: props.newPassword,
    });
    // A reset usually means the password leaked: sign the user out everywhere
    await this.revokeSessions?.execute({ userId: payload.sub });
  }
}
