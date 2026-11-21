import { EntityNotFoundError } from '../../../shared/domain/errors';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { MatrixApiError, MatrixClient } from '../matrix-client';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';
import { matrixBotWithToken } from './matrix-room-check';

/** A saved room as the bot sees it now. */
export interface MatrixRoomStatus {
  roomId: string;
  /** False when the bot is no longer in the room (taken out, or it never got in): it has to be invited again. */
  inRoom: boolean;
  name: string | null;
  alias: string | null;
  members: number | null;
}

/**
 * Looks at a saved room without entering it: whether the bot is still in it, and its name and
 * members. Unlike checking a room, the bot never joins here, so a room it was taken out of stays
 * without it until someone invites it again.
 */
export class InspectMatrixRoom {
  constructor(
    private readonly botRepository: MatrixBotRepository,
    private readonly roomRepository: MatrixRoomRepository,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
  ) {}

  async execute(props: { workspaceId: string; id: string }): Promise<MatrixRoomStatus> {
    const room = await this.roomRepository.findById(props.id);
    if (!room || room.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Matrix room not found');
    const { bot, token } = await matrixBotWithToken(this.botRepository, this.cipher, props.workspaceId);
    const out: MatrixRoomStatus = { roomId: room.roomId, inRoom: false, name: null, alias: null, members: null };

    const membership = await this.client.membership(bot.homeserverUrl, token, room.roomId, bot.userId).catch((error) => {
      // The server does not let a bot that is not in the room read it
      if (error instanceof MatrixApiError && (error.status === 403 || error.status === 404)) return null;
      throw error;
    });
    if (membership !== 'join') return out;

    const summary = await this.client.roomSummary(bot.homeserverUrl, token, room.roomId).catch(() => null);
    return { ...out, inRoom: true, name: summary?.name ?? null, alias: summary?.alias ?? null, members: summary?.joinedMembers ?? null };
  }
}
