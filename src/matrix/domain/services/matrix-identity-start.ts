import { IdGenerator } from '../../../shared/domain/id-generator';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { ConflictError, DomainValidationError, TooManyRequestsError } from '../../../shared/domain/errors';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixIdentity } from '../entities/matrix-identity';
import { MatrixApiError, MatrixClient } from '../matrix-client';
import { matrixIdentityStatus } from '../matrix-identity-status';
import { matrixText } from '../matrix-notice-texts';
import { realSleep, withMatrixRetries } from '../matrix-retries';
import { parseMatrixUserId } from '../matrix-user-id';
import {
  MATRIX_CODE_COOLDOWN_MS,
  MATRIX_CODE_TTL_MS,
  MATRIX_CODE_WINDOW_MS,
  MATRIX_CODES_PER_DAY,
  hashMatrixCode,
  newMatrixCode,
} from '../matrix-verification-code';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixIdentityRepository } from '../repositories/matrix-identity.repository';
import { FindMatrixDirectBot } from './matrix-direct-bot-find';
import { OpenMatrixDirectRoom } from './matrix-direct-room-open';
import { CloseMatrixDirectRooms } from './matrix-direct-rooms-close';

const APP_NAME = process.env.APP_NAME || 'Open Helpdesk';

/** The user is in the chat, or invited to it: the code reaches them. */
const REACHES = new Set(['join', 'invite']);

interface Props {
  userId: string;
  matrixUserId: string;
  lang: string | null;
}

/**
 * Connects a user's Matrix account: the bot opens a direct chat with it and sends a six-digit code,
 * which only someone who can read that account sees. Until the code is typed nothing is sent there.
 * Codes are spaced out and capped per day, since each one can mean an invitation to that account;
 * the limits stay when the account is disconnected. A verified account being changed for another
 * keeps the notices until the new one is verified.
 */
export class StartMatrixIdentityVerification {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly identityRepository: MatrixIdentityRepository,
    private readonly botRepository: MatrixBotRepository,
    private readonly findBot: FindMatrixDirectBot,
    private readonly openRoom: OpenMatrixDirectRoom,
    private readonly closeRooms: CloseMatrixDirectRooms,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(props: Props): Promise<MatrixIdentity> {
    const matrixUserId = parseMatrixUserId(props.matrixUserId);
    // First whether the user may connect at all: only then is it told that an ID is a bot's
    const bot = await this.findBot.execute(props.userId);
    if (!bot) throw new DomainValidationError('Matrix notices are not set up for your workspaces', 'matrix-unavailable');
    const bots = await this.botRepository.findAll();
    if (bots.some((b) => b.userId.toLowerCase() === matrixUserId.toLowerCase())) {
      throw new DomainValidationError('That is the helpdesk\'s own bot: type your own Matrix ID', 'matrix-is-bot');
    }

    const now = this.now();
    let identity = await this.identityRepository.findByUserId(props.userId);
    if (identity?.matrixUserId === matrixUserId && matrixIdentityStatus(identity) === 'verified') {
      throw new ConflictError('That Matrix account is already connected', 'matrix-already-connected');
    }
    if (identity) this.ensureMayResend(identity, now);

    const token = this.cipher.decrypt(bot.encryptedAccessToken);
    if (!token) throw new DomainValidationError('The helpdesk\'s Matrix bot needs to be connected again', 'matrix-bot-gone');
    if (identity && matrixIdentityStatus(identity) === 'verified') return this.startChange(identity, bot, token, matrixUserId, props.lang, now);

    if (!identity || identity.matrixUserId !== matrixUserId) {
      // A new ID: the chats with the old one are of no use any more
      if (identity?.matrixUserId) await this.closeRooms.execute(props.userId);
      identity = new MatrixIdentity({
        id: identity?.getId() ?? this.idGenerator.create(),
        userId: props.userId,
        matrixUserId,
        verifiedAt: null,
        codeHash: null,
        codeExpiresAt: null,
        codeAttempts: 0,
        codeSentAt: identity?.codeSentAt ?? null,
        codeSends: identity?.codeSends ?? 0,
        sendWindowStartedAt: identity?.sendWindowStartedAt ?? null,
      });
    }

    const code = this.issueCode(identity, now);
    // Saved before the bot writes: a failed attempt still counts against the limits
    await this.identityRepository.save(identity);

    try {
      const open = { bot, userId: props.userId, matrixUserId, lang: props.lang };
      let room = await this.openRoom.execute(open);
      // They rejected or left the chat of an earlier code: a new invitation, or the code goes nowhere
      if (!(await this.reaches(bot, token, room.roomId, matrixUserId))) room = await this.openRoom.reopen(open);
      await this.sendCode(bot, token, room.roomId, identity, code, props.lang, now);
    } catch (error) {
      throw this.unreachable(error, matrixUserId);
    }
    return identity;
  }

  /**
   * A verified user typing another ID: the verified one keeps the notices and its chats until the
   * new one's code is typed. The code goes to a chat of its own with the new ID, the same one while
   * they ask again, which becomes the bot's direct chat with them once verified.
   */
  private async startChange(identity: MatrixIdentity, bot: MatrixBot, token: string, matrixUserId: string, lang: string | null, now: Date): Promise<MatrixIdentity> {
    const previous = identity.pendingBotId && identity.pendingRoomId ? { botId: identity.pendingBotId, roomId: identity.pendingRoomId } : null;
    const sameChange = identity.pendingMatrixUserId === matrixUserId && identity.pendingBotId === bot.getId();
    const code = this.issueCode(identity, now);
    identity.pendingMatrixUserId = matrixUserId;
    identity.pendingBotId = bot.getId();
    if (!sameChange) identity.pendingRoomId = null;
    await this.identityRepository.save(identity);

    try {
      let roomId = identity.pendingRoomId;
      if (roomId && !(await this.reaches(bot, token, roomId, matrixUserId))) roomId = null;
      if (previous && previous.roomId !== roomId) await this.closeRooms.leaveUnsaved(previous.botId, previous.roomId);
      if (!roomId) {
        const name = matrixText(lang, 'roomName', { app: APP_NAME });
        // Retried only when rate limited: after another failure the room may exist and the user be invited
        roomId = await withMatrixRetries(() => this.client.createDirectRoom(bot.homeserverUrl, token, matrixUserId, name), realSleep, true);
        identity.pendingRoomId = roomId;
        await this.identityRepository.save(identity);
      }
      await this.sendCode(bot, token, roomId, identity, code, lang, now);
    } catch (error) {
      throw this.unreachable(error, matrixUserId);
    }
    return identity;
  }

  /** Whether the user is in that chat or invited to it: otherwise a code sent there goes nowhere. */
  private async reaches(bot: MatrixBot, token: string, roomId: string, matrixUserId: string): Promise<boolean> {
    const membership = await this.client.membership(bot.homeserverUrl, token, roomId, matrixUserId).catch((error) => {
      if (error instanceof MatrixApiError && (error.status === 403 || error.status === 404)) return null;
      throw error;
    });
    return !!membership && REACHES.has(membership);
  }

  private issueCode(identity: MatrixIdentity, now: Date): string {
    const code = newMatrixCode();
    if (!identity.sendWindowStartedAt || now.getTime() - identity.sendWindowStartedAt.getTime() >= MATRIX_CODE_WINDOW_MS) {
      identity.sendWindowStartedAt = now;
      identity.codeSends = 0;
    }
    identity.codeSends++;
    identity.codeSentAt = now;
    identity.codeHash = hashMatrixCode(identity.getId(), code);
    identity.codeExpiresAt = new Date(now.getTime() + MATRIX_CODE_TTL_MS);
    identity.codeAttempts = 0;
    return code;
  }

  private async sendCode(bot: MatrixBot, token: string, roomId: string, identity: MatrixIdentity, code: string, lang: string | null, now: Date): Promise<void> {
    const body = matrixText(lang, 'code', { app: APP_NAME, code });
    await withMatrixRetries(() => this.client.sendMessage(bot.homeserverUrl, token, roomId, `ohd-code-${identity.getId()}-${now.getTime()}`, { msgtype: 'm.text', body }));
  }

  private unreachable(error: unknown, matrixUserId: string): Error {
    if (!(error instanceof MatrixApiError)) return error as Error;
    return new DomainValidationError(`The bot could not write to ${matrixUserId}: ${error.message}`, 'matrix-unreachable');
  }

  private ensureMayResend(identity: MatrixIdentity, now: Date): void {
    if (identity.codeSentAt && now.getTime() - identity.codeSentAt.getTime() < MATRIX_CODE_COOLDOWN_MS) {
      throw new TooManyRequestsError('A code was just sent: wait a minute before asking for another', 'matrix-too-soon');
    }
    const windowOpen = identity.sendWindowStartedAt && now.getTime() - identity.sendWindowStartedAt.getTime() < MATRIX_CODE_WINDOW_MS;
    if (windowOpen && identity.codeSends >= MATRIX_CODES_PER_DAY) {
      throw new TooManyRequestsError('Too many codes today: try again tomorrow', 'matrix-too-many-today');
    }
  }
}
