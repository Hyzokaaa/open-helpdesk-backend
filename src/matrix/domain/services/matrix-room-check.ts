import { ConflictError, DomainValidationError } from '../../../shared/domain/errors';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixApiError, MatrixClient } from '../matrix-client';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';
import { ResolveMatrixBot } from './matrix-bot-resolve';

/** What the room is, as the bot sees it once inside. */
export interface MatrixRoomCheck {
  roomId: string;
  name: string | null;
  alias: string | null;
  /** Joined members, the bot included. */
  members: number | null;
}

/** A room typed, known by its ID but not joined yet. */
export interface ResolvedMatrixRoom {
  roomId: string;
  /** As typed: an address is joined through its own server, which matters for a room elsewhere. */
  typed: string;
  bot: MatrixBot;
  token: string;
}

/**
 * Makes sure a room exists and the bot may write in it: the bot joins it (accepting the
 * invitation) and reads its name and members. The name is a courtesy: if it cannot be read,
 * the room is still fine. A room another workspace uses is refused before the bot joins it.
 */
export class CheckMatrixRoom {
  constructor(
    private readonly botRepository: MatrixBotRepository,
    private readonly roomRepository: MatrixRoomRepository,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
  ) {}

  async execute(props: { workspaceId: string; room: string; actorIsSystemAdmin: boolean }): Promise<MatrixRoomCheck> {
    const resolved = await this.resolve(props.workspaceId, props.room);
    await this.refuseAnotherWorkspaces(props.workspaceId, resolved.roomId, props.actorIsSystemAdmin);
    const roomId = await this.enter(resolved);
    const summary = await this.client.roomSummary(resolved.bot.homeserverUrl, resolved.token, roomId).catch(() => null);
    return { roomId, name: summary?.name ?? null, alias: summary?.alias ?? null, members: summary?.joinedMembers ?? null };
  }

  /** The room typed (ID or address) by its ID, without joining it. */
  async resolve(workspaceId: string, typedRoom: string): Promise<ResolvedMatrixRoom> {
    const typed = typedRoom.trim();
    if (!/^[!#][^:\s]+(:[^\s]+)?$/.test(typed)) throw new DomainValidationError('Type the room\'s ID (!…) or its address (#name:server)');

    const { bot, token } = await matrixBotWithToken(this.botRepository, this.cipher, workspaceId);
    if (typed.startsWith('!')) return { roomId: typed, typed, bot, token };
    try {
      return { roomId: await this.client.resolveRoomAlias(bot.homeserverUrl, token, typed), typed, bot, token };
    } catch (error) {
      throw explain(error, bot.userId);
    }
  }

  /**
   * A room another workspace sends its notices to is only shared by a system admin; a room this
   * workspace already uses stays its own, also when an admin shared it.
   */
  async refuseAnotherWorkspaces(workspaceId: string, roomId: string, actorIsSystemAdmin: boolean): Promise<void> {
    if (actorIsSystemAdmin) return;
    const users = await this.roomRepository.findByRoomId(roomId);
    if (users.some((r) => r.workspaceId !== workspaceId) && !users.some((r) => r.workspaceId === workspaceId)) {
      throw new ConflictError('Another workspace already sends its notices to that room');
    }
  }

  /** The bot joins the room (accepting the invitation); answers its ID. */
  async enter(room: ResolvedMatrixRoom): Promise<string> {
    try {
      return await this.client.joinRoom(room.bot.homeserverUrl, room.token, room.typed);
    } catch (error) {
      throw explain(error, room.bot.userId);
    }
  }
}

/** The bot that speaks for the workspace (its own, or the installation's) and its token. */
export async function matrixBotWithToken(botRepository: MatrixBotRepository, cipher: SecretCipher, workspaceId: string): Promise<{ bot: MatrixBot; token: string }> {
  const bot = await new ResolveMatrixBot(botRepository).execute(workspaceId);
  if (!bot) throw new DomainValidationError('Connect a Matrix bot first');
  const token = cipher.decrypt(bot.encryptedAccessToken);
  if (!token) throw new DomainValidationError('Connect the Matrix bot again: its saved token can no longer be read');
  return { bot, token };
}

function explain(error: unknown, botUserId: string): Error {
  if (!(error instanceof MatrixApiError)) return error as Error;
  if (error.status === 403) return new DomainValidationError(`Invite ${botUserId} to the room first`);
  if (error.status === 404) return new DomainValidationError('The Matrix server does not know that room');
  if (error.status === 401) return new DomainValidationError('The Matrix server no longer accepts the bot\'s token: connect the bot again');
  if (error.status === 0) return new DomainValidationError(`Could not reach the Matrix server: ${error.message}`);
  return new DomainValidationError(`The Matrix server answered: ${error.message}`);
}
