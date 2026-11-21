import { Command } from '../../../shared/domain/command';
import { ReconnectMatrixDirectChat } from '../../domain/services/matrix-direct-chat-reconnect';

interface Props {
  userId: string;
  botId: string;
  lang: string | null;
}

export class ReconnectMatrixDirectChatCommand implements Command<Props, void> {
  constructor(private readonly reconnect: ReconnectMatrixDirectChat) {}

  async execute(props: Props): Promise<void> {
    await this.reconnect.execute(props);
  }
}
