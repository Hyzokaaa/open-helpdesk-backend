import { Command } from '../../../shared/domain/command';
import { EndUserSession } from '../../domain/services/user-session-end';

interface Props {
  refreshToken: string;
}

export class LogoutCommand implements Command<Props, void> {
  constructor(private readonly endSession: EndUserSession) {}

  async execute(props: Props): Promise<void> {
    await this.endSession.execute({ refreshToken: props.refreshToken });
  }
}
