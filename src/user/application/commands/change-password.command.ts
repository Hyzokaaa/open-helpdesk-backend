import { Command } from '../../../shared/domain/command';
import { ChangePassword } from '../../domain/services/user-change-password';

interface Props {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordCommand implements Command<Props, void> {
  constructor(private readonly changePassword: ChangePassword) {}

  async execute(props: Props): Promise<void> {
    await this.changePassword.execute(props);
  }
}
