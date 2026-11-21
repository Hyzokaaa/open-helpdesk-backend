import { Command } from '../../../shared/domain/command';
import { DisconnectMatrixIdentity } from '../../domain/services/matrix-identity-disconnect';

export class DisconnectMatrixIdentityCommand implements Command<{ userId: string }, void> {
  constructor(private readonly disconnect: DisconnectMatrixIdentity) {}

  async execute(props: { userId: string }): Promise<void> {
    await this.disconnect.execute(props.userId);
  }
}
