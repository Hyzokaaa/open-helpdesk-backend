import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { MatrixApiError, MatrixClient } from '../matrix-client';
import { matrixIdentityStatus } from '../matrix-identity-status';
import { matrixText } from '../matrix-notice-texts';
import { withMatrixRetries } from '../matrix-retries';
import { MatrixIdentityRepository } from '../repositories/matrix-identity.repository';
import { ListMatrixDirectChats } from './matrix-direct-chats-list';
import { OpenMatrixDirectRoom } from './matrix-direct-room-open';

const APP_NAME = process.env.APP_NAME || 'Open Helpdesk';

/**
 * Resumes a bot's notices after the user left or rejected its chat: the bot invites them to a new
 * one. Their account is still verified, so no code is needed; only a bot that writes for them.
 */
export class ReconnectMatrixDirectChat {
  constructor(
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly identityRepository: MatrixIdentityRepository,
    private readonly listChats: ListMatrixDirectChats,
    private readonly openRoom: OpenMatrixDirectRoom,
  ) {}

  async execute(props: { userId: string; botId: string; lang: string | null }): Promise<void> {
    const identity = await this.identityRepository.findByUserId(props.userId);
    if (matrixIdentityStatus(identity) !== 'verified' || !identity?.matrixUserId) {
      throw new DomainValidationError('Connect your Matrix account first', 'matrix-not-connected');
    }
    const chat = (await this.listChats.execute(props.userId)).find((c) => c.bot.getId() === props.botId);
    if (!chat) throw new EntityNotFoundError('That bot does not write to you');

    const token = this.cipher.decrypt(chat.bot.encryptedAccessToken);
    if (!token) throw new DomainValidationError('The helpdesk\'s Matrix bot needs to be connected again', 'matrix-bot-gone');
    try {
      const room = await this.openRoom.reopen({ bot: chat.bot, userId: props.userId, matrixUserId: identity.matrixUserId, lang: props.lang });
      const body = matrixText(props.lang, 'dmResumed', { app: APP_NAME });
      await withMatrixRetries(() => this.client.sendMessage(chat.bot.homeserverUrl, token, room.roomId, `ohd-dm-resumed-${room.getId()}`, { msgtype: 'm.notice', body }));
    } catch (error) {
      if (!(error instanceof MatrixApiError)) throw error;
      throw new DomainValidationError(`The bot could not write to ${identity.matrixUserId}: ${error.message}`, 'matrix-unreachable');
    }
  }
}
