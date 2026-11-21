import { IdGenerator } from '../../../shared/domain/id-generator';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { MatrixStandaloneNoticeEvent } from '../../../notification/domain/matrix-personal-notice';
import { noticeLang } from '../../../notification/domain/notice-kind';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { MatrixClient } from '../matrix-client';
import { matrixIdentityStatus } from '../matrix-identity-status';
import { matrixNoticeContent } from '../matrix-notice-content';
import { MatrixNoticeThrottle } from '../matrix-notice-throttle';
import { Sleep, realSleep, withMatrixRetries } from '../matrix-retries';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixDirectRoomRepository } from '../repositories/matrix-direct-room.repository';
import { MatrixIdentityRepository } from '../repositories/matrix-identity.repository';
import { ResolveMatrixBot } from './matrix-bot-resolve';
import { MatrixDirectNotified, matrixDirectThrottleKey } from './matrix-direct-notify';
import { OpenMatrixDirectRoom } from './matrix-direct-room-open';
import { ReachMatrixDirectRoom } from './matrix-direct-room-reach';

/**
 * Sends a notice that is not about a ticket to each user's direct chat with the workspace's bot (its
 * own, else the installation's), or with the installation's when it is about no workspace: on its
 * own, outside any ticket's thread, in the user's language. Only to verified accounts; whom it is
 * for was settled by the notice's kind.
 */
export class NotifyMatrixStandalone {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly botRepository: MatrixBotRepository,
    private readonly identityRepository: MatrixIdentityRepository,
    private readonly directRoomRepository: MatrixDirectRoomRepository,
    private readonly userRepository: UserRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly openRoom: OpenMatrixDirectRoom,
    private readonly frontendUrl: (workspaceId: string | null) => Promise<string>,
    private readonly throttle: MatrixNoticeThrottle,
    private readonly sleep: Sleep = realSleep,
  ) {}

  async execute(event: MatrixStandaloneNoticeEvent): Promise<MatrixDirectNotified> {
    const result: MatrixDirectNotified = { sent: 0, failures: [] };
    const identities = (await this.identityRepository.findByUserIds(event.userIds)).filter((i) => matrixIdentityStatus(i) === 'verified');
    if (identities.length === 0) return result;

    const bot = event.workspaceId
      ? await new ResolveMatrixBot(this.botRepository).execute(event.workspaceId)
      : await this.botRepository.findInstallation();
    const token = bot ? this.cipher.decrypt(bot.encryptedAccessToken) : null;
    if (!bot || !token) return result;

    const users = new Map((await this.userRepository.findByIds(identities.map((i) => i.userId))).map((u) => [u.getId(), u]));
    const url = `${await this.frontendUrl(event.workspaceId)}${event.path}`;
    const reach = new ReachMatrixDirectRoom(this.idGenerator, this.client, this.cipher, this.directRoomRepository, this.auditLogRepository, this.openRoom, this.sleep);
    const occurrence = this.idGenerator.create();
    for (const identity of identities) {
      const user = users.get(identity.userId);
      if (!user?.isActive || !identity.matrixUserId) continue;
      try {
        // A paused chat is not counted against the minute's notices
        const paused = (await this.directRoomRepository.find(bot.getId(), user.getId()))?.lostAt;
        if (paused || !this.throttle.take(matrixDirectThrottleKey(bot.getId(), user.getId()))) continue;
        const room = await reach.execute({ bot, token, userId: user.getId(), matrixUserId: identity.matrixUserId, lang: user.language });
        if (!room) continue;

        const lang = noticeLang(user.language);
        const content = matrixNoticeContent({ icon: event.icon, headline: event.headline[lang], subject: '', details: [], link: { url, label: event.action[lang] } }, null);
        const txnId = `ohd-notice-${occurrence}-${user.getId()}`;
        await withMatrixRetries(() => this.client.sendMessage(bot.homeserverUrl, token, room.roomId, txnId, content), this.sleep);
        result.sent++;
      } catch (error) {
        // One user's chat failing never keeps the notice from the others
        result.failures.push({ userId: user.getId(), error: (error as Error).message });
      }
    }
    return result;
  }
}
