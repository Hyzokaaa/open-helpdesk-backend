import { DomainValidationError } from '../../../shared/domain/errors';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { MatrixApiError, MatrixClient } from '../matrix-client';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { matrixBotWithToken } from './matrix-room-check';

/** More would be a mailing list, not a room of the team. */
const MAX_INVITES = 20;
const ADMIN = 100;

export interface NewMatrixRoom {
  name: string;
  /** Matrix user IDs (@name:server): they are invited and made admins of the room. */
  invite: string[];
}

export interface CreatedMatrixRoom {
  roomId: string;
  /** Who could not be invited, and what the server answered. */
  notInvited: Array<{ userId: string; error: string }>;
  /** Whether the invited became admins; if not, the bot stays the room's only admin. */
  adminsSet: boolean;
}

/**
 * The bot creates a private, invite-only room without encryption, invites the people given and
 * makes them admins, so the room keeps an owner if the bot changes. Each invitation is its own
 * call, so one wrong ID does not lose the room. The bot never deletes or leaves the room.
 */
export class CreateMatrixRoom {
  constructor(
    private readonly botRepository: MatrixBotRepository,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
  ) {}

  /** Refuses a wrong name or invitee before anything is created. */
  static validate(props: NewMatrixRoom): NewMatrixRoom {
    const name = props.name.trim();
    if (!name) throw new DomainValidationError('Give the new room a name');
    if (name.length > 255) throw new DomainValidationError('The room\'s name is too long');
    const invite = [...new Set(props.invite.map((u) => u.trim()).filter(Boolean))];
    const wrong = invite.find((u) => !/^@[^:\s]+:[^\s]+$/.test(u));
    if (wrong) throw new DomainValidationError(`"${wrong}" is not a Matrix ID: write it as @name:server`);
    if (invite.length > MAX_INVITES) throw new DomainValidationError(`Invite at most ${MAX_INVITES} people`);
    return { name, invite };
  }

  async execute(props: { workspaceId: string } & NewMatrixRoom): Promise<CreatedMatrixRoom> {
    const { name, invite } = CreateMatrixRoom.validate(props);
    const { bot, token } = await matrixBotWithToken(this.botRepository, this.cipher, props.workspaceId);
    const invitees = invite.filter((u) => u !== bot.userId);

    let roomId: string;
    try {
      roomId = await this.client.createRoom(bot.homeserverUrl, token, name);
    } catch (error) {
      throw explain(error);
    }

    const notInvited: CreatedMatrixRoom['notInvited'] = [];
    for (const userId of invitees) {
      await this.client.invite(bot.homeserverUrl, token, roomId, userId).catch((error: Error) => notInvited.push({ userId, error: error.message }));
    }

    const admins = invitees.filter((u) => !notInvited.some((n) => n.userId === u));
    let adminsSet = true;
    if (admins.length > 0) {
      // Read first and add to it: a room of version 12 or later must not list its creator
      adminsSet = await this.client.powerLevels(bot.homeserverUrl, token, roomId)
        .then((levels) => {
          const users = { ...(levels.users as Record<string, number> | undefined), ...Object.fromEntries(admins.map((u) => [u, ADMIN])) };
          return this.client.setPowerLevels(bot.homeserverUrl, token, roomId, { ...levels, users });
        })
        .then(() => true, () => false);
    }
    return { roomId, notInvited, adminsSet };
  }
}

function explain(error: unknown): Error {
  if (!(error instanceof MatrixApiError)) return error as Error;
  if (error.status === 403) return new DomainValidationError('The Matrix server does not let the bot create rooms: create it yourself and invite the bot');
  if (error.status === 429) return new DomainValidationError('The Matrix server asks to wait before creating another room: try again in a minute');
  if (error.status === 401) return new DomainValidationError('The Matrix server no longer accepts the bot\'s token: connect the bot again');
  if (error.status === 0) return new DomainValidationError(`Could not reach the Matrix server: ${error.message}`);
  return new DomainValidationError(`The Matrix server answered: ${error.message}`);
}
