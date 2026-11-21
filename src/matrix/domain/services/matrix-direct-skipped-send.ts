import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { MatrixClient } from '../matrix-client';
import { escapeHtml } from '../../../shared/domain/sanitize-html';
import { matrixText } from '../matrix-notice-texts';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixDirectRoomRepository } from '../repositories/matrix-direct-room.repository';

const APP_NAME = process.env.APP_NAME || 'Open Helpdesk';

/** Tells a user, in their chat with a bot, how many notices a busy minute left out there. */
export class SendMatrixDirectSkipped {
  constructor(
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly botRepository: MatrixBotRepository,
    private readonly directRoomRepository: MatrixDirectRoomRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(props: { botId: string; userId: string; count: number }): Promise<void> {
    const room = await this.directRoomRepository.find(props.botId, props.userId);
    if (!room || room.lostAt) return;
    const bot = await this.botRepository.findById(props.botId);
    const token = bot ? this.cipher.decrypt(bot.encryptedAccessToken) : null;
    if (!bot || !token) return;
    const user = await this.userRepository.findById(props.userId);
    const text = matrixText(user?.language ?? null, 'dmSkipped', { count: props.count, app: APP_NAME });
    await this.client.sendMessage(bot.homeserverUrl, token, room.roomId, `ohd-dm-skipped-${room.getId()}-${Date.now()}`, {
      msgtype: 'm.notice',
      body: `ℹ️ ${text}`,
      format: 'org.matrix.custom.html',
      formatted_body: `ℹ️ ${escapeHtml(text)}`,
    });
  }
}
