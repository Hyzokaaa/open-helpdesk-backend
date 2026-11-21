import { EntityNotFoundError } from '../../../shared/domain/errors';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixClient } from '../matrix-client';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { CloseMatrixDirectRooms } from './matrix-direct-rooms-close';

/**
 * Disconnects a bot: ends its session on the Matrix server, so the token stops working even in a
 * copy of the database, and forgets it. Forgetting goes ahead when the server cannot be reached;
 * the answer says whether the session was ended. First the bot leaves the users' direct chats, so
 * none is left with a bot that no longer answers.
 */
export class DisconnectMatrixBot {
  constructor(
    private readonly repository: MatrixBotRepository,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly closeDirectRooms: CloseMatrixDirectRooms,
  ) {}

  async execute(props: { workspaceId: string | null }): Promise<{ bot: MatrixBot; sessionEnded: boolean }> {
    const bot = props.workspaceId ? await this.repository.findByWorkspaceId(props.workspaceId) : await this.repository.findInstallation();
    if (!bot) throw new EntityNotFoundError('No Matrix bot is connected');

    const token = this.cipher.decrypt(bot.encryptedAccessToken);
    await this.closeDirectRooms.ofBot(bot, token);
    const sessionEnded = token
      ? await this.client.logout(bot.homeserverUrl, token).then(() => true, () => false)
      : false;
    await this.repository.delete(bot.getId());
    return { bot, sessionEnded };
  }
}
