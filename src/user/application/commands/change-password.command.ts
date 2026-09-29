import { Command } from '../../../shared/domain/command';
import { ChangePassword } from '../../domain/services/user-change-password';
import { RevokeUserSessions } from '../../domain/services/user-sessions-revoke';

interface Props {
  userId: string;
  currentPassword: string;
  newPassword: string;
  /** The session making the change, which stays signed in. */
  sessionId?: string;
}

export class ChangePasswordCommand implements Command<Props, void> {
  constructor(
    private readonly changePassword: ChangePassword,
    private readonly revokeSessions?: RevokeUserSessions,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.changePassword.execute({
      userId: props.userId,
      currentPassword: props.currentPassword,
      newPassword: props.newPassword,
    });
    // Whoever knew the old password is signed out everywhere else
    await this.revokeSessions?.execute({ userId: props.userId, exceptSessionId: props.sessionId });
  }
}
