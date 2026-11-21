import { DomainValidationError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixApiError, MatrixClient } from '../matrix-client';
import { ensureSecureHomeserver } from '../matrix-homeserver-url';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { HandOverMatrixRooms, MatrixRoomsHandOver } from './matrix-rooms-hand-over';

/** The name the bot's session shows in the Matrix clients' list of sessions. */
export const MATRIX_DEVICE_NAME = 'Open Helpdesk';

interface Props {
  /** Null for the installation's bot. */
  workspaceId: string | null;
  /** @user:server */
  userId: string;
  password?: string | null;
  accessToken?: string | null;
  /** Only when the server name does not lead to it (no .well-known). */
  homeserverUrl?: string | null;
}

/** The server part of a Matrix ID, or null when it is not one. */
export function matrixServerName(userId: string): string | null {
  const match = /^@[^:\s]+:([A-Za-z0-9.-]+(?::\d+)?)$/.exec(userId.trim());
  return match ? match[1] : null;
}

export interface ConnectedMatrixBot {
  bot: MatrixBot;
  /** When another account replaced the bot: the rooms it got into, and those it could not. */
  handOver: MatrixRoomsHandOver | null;
}

/**
 * Connects a bot: finds its homeserver, logs in once with the password (or checks the token it
 * was given), and keeps only the token, encrypted. A bot connected before for the same scope is
 * replaced, and its session ended so the old token stops working; when the new bot is another
 * account, it is first brought into the old one's rooms.
 */
export class ConnectMatrixBot {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: MatrixBotRepository,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    /** Refuses homeservers the installation does not let this scope reach (see ensurePublicUrl). */
    private readonly ensureReachable: (url: string) => Promise<void>,
    private readonly handOver: HandOverMatrixRooms,
  ) {}

  async execute(props: Props): Promise<ConnectedMatrixBot> {
    const userId = props.userId.trim();
    const serverName = matrixServerName(userId);
    if (!serverName) throw new DomainValidationError('Type the bot\'s full Matrix ID, like @helpdesk:example.org');
    if (!props.password && !props.accessToken) throw new DomainValidationError('Type the bot\'s password or an access token');

    // The discovery itself is a request to the typed server
    if (!props.homeserverUrl?.trim()) await this.ensureReachable(`https://${serverName}`);
    const homeserverUrl = await this.homeserver(serverName, props.homeserverUrl);
    // Typed or found in the server's .well-known: neither may be plain http on the internet
    ensureSecureHomeserver(homeserverUrl);
    await this.ensureReachable(homeserverUrl);

    const session = props.password
      ? await this.logIn(homeserverUrl, userId, props.password)
      : { accessToken: props.accessToken!.trim(), deviceId: null as string | null };
    const who = await this.client.whoami(homeserverUrl, session.accessToken).catch((error) => {
      throw this.explain(error);
    });
    if (who.userId.toLowerCase() !== userId.toLowerCase()) {
      if (props.password) await this.client.logout(homeserverUrl, session.accessToken).catch(() => undefined);
      throw new DomainValidationError(`That token belongs to ${who.userId}, not to ${userId}`);
    }

    const existing = props.workspaceId ? await this.repository.findByWorkspaceId(props.workspaceId) : await this.repository.findInstallation();
    const bot = new MatrixBot({
      id: existing?.getId() ?? this.idGenerator.create(),
      workspaceId: props.workspaceId,
      homeserverUrl,
      userId: who.userId,
      deviceId: who.deviceId ?? session.deviceId,
      encryptedAccessToken: this.cipher.encrypt(session.accessToken),
    });
    await this.repository.save(bot);

    let handOver: MatrixRoomsHandOver | null = null;
    if (existing && existing.userId.toLowerCase() !== bot.userId.toLowerCase()) {
      handOver = await this.handOver.execute({ old: existing, oldToken: this.cipher.decrypt(existing.encryptedAccessToken), bot, token: session.accessToken });
    }
    if (existing) await this.endSession(existing, session.accessToken);
    return { bot, handOver };
  }

  private async homeserver(serverName: string, typed: string | null | undefined): Promise<string> {
    if (typed?.trim()) {
      const url = typed.trim().replace(/\/+$/, '');
      if (!/^https?:\/\/[^/]+/.test(url)) throw new DomainValidationError('The server address has to start with https://');
      return url;
    }
    return (await this.client.discoverHomeserver(serverName)) ?? `https://${serverName}`;
  }

  private async logIn(homeserverUrl: string, userId: string, password: string) {
    try {
      return await this.client.login(homeserverUrl, userId, password, MATRIX_DEVICE_NAME);
    } catch (error) {
      throw this.explain(error);
    }
  }

  /** Ends the replaced bot's session, unless it is the one just saved (the same token typed again). */
  private async endSession(previous: MatrixBot, currentToken: string): Promise<void> {
    const token = this.cipher.decrypt(previous.encryptedAccessToken);
    if (!token || token === currentToken) return;
    await this.client.logout(previous.homeserverUrl, token).catch(() => undefined);
  }

  private explain(error: unknown): Error {
    if (!(error instanceof MatrixApiError)) return error as Error;
    if (error.status === 0) return new DomainValidationError(`Could not reach the Matrix server: ${error.message}`);
    if (error.status === 403 && error.errcode === 'M_FORBIDDEN') return new DomainValidationError('Wrong Matrix user or password');
    if (error.status === 401) return new DomainValidationError('The Matrix server did not accept that access token');
    if (error.status === 429) return new DomainValidationError('The Matrix server asks to wait before trying again');
    return new DomainValidationError(`The Matrix server answered: ${error.message}`);
  }
}
