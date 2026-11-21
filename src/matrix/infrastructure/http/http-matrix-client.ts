import { Inject, Injectable } from '@nestjs/common';
import { PrivateNetworkUrlError, privateNetworkUrlsAllowed } from '../../../shared/infrastructure/private-network';
import { publicHttpRequest } from '../../../shared/infrastructure/public-http-request';
import { MatrixApiError, MatrixClient, MatrixLogin, MatrixMessageContent } from '../../domain/matrix-client';
import { TypeOrmMatrixBotRepository } from '../typeorm/repositories/typeorm-matrix-bot.repository';

const TIMEOUT_MS = 10_000;
/** A file of up to 10 MB may take longer than a message over a slow link. */
const UPLOAD_TIMEOUT_MS = 60_000;
/** How long the installation bot's server is remembered as the one never limited. */
const TRUSTED_HOST_TTL_MS = 60_000;

interface Exchange {
  method: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
}

interface Answer {
  status: number;
  text: string;
  header(name: string): string | null;
}

/**
 * The Matrix client-server API over plain HTTP: no SDK, no sync loop, no end-to-end encryption.
 * With ALLOW_PRIVATE_NETWORK_URLS=false, every server but the installation bot's is reached only
 * at public addresses, checked when connecting (a workspace's server cannot be pointed inside later).
 */
@Injectable()
export class HttpMatrixClient implements MatrixClient {
  private trustedHost: { host: string | null; until: number } | null = null;

  constructor(@Inject() private readonly botRepository: TypeOrmMatrixBotRepository) {}

  async discoverHomeserver(serverName: string): Promise<string | null> {
    try {
      const answer = await this.exchange(`https://${serverName}/.well-known/matrix/client`, { method: 'GET' }, TIMEOUT_MS);
      if (answer.status < 200 || answer.status >= 300) return null;
      const body = JSON.parse(answer.text) as { 'm.homeserver'?: { base_url?: string } };
      const url = body['m.homeserver']?.base_url;
      return typeof url === 'string' && /^https?:\/\//.test(url) ? url.replace(/\/+$/, '') : null;
    } catch {
      return null;
    }
  }

  async login(homeserverUrl: string, user: string, password: string, deviceName: string): Promise<MatrixLogin> {
    const body = await this.call<{ access_token: string; user_id: string; device_id?: string }>(homeserverUrl, 'POST', '/login', null, {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user },
      password,
      initial_device_display_name: deviceName,
    });
    return { accessToken: body.access_token, userId: body.user_id, deviceId: body.device_id ?? null };
  }

  async whoami(homeserverUrl: string, accessToken: string): Promise<{ userId: string; deviceId: string | null }> {
    const body = await this.call<{ user_id: string; device_id?: string }>(homeserverUrl, 'GET', '/account/whoami', accessToken);
    return { userId: body.user_id, deviceId: body.device_id ?? null };
  }

  async logout(homeserverUrl: string, accessToken: string): Promise<void> {
    await this.call(homeserverUrl, 'POST', '/logout', accessToken, {});
  }

  async resolveRoomAlias(homeserverUrl: string, accessToken: string, alias: string): Promise<string> {
    const body = await this.call<{ room_id: string }>(homeserverUrl, 'GET', `/directory/room/${encodeURIComponent(alias)}`, accessToken);
    return body.room_id;
  }

  async joinRoom(homeserverUrl: string, accessToken: string, roomIdOrAlias: string): Promise<string> {
    const body = await this.call<{ room_id: string }>(homeserverUrl, 'POST', `/join/${encodeURIComponent(roomIdOrAlias)}`, accessToken, {});
    return body.room_id;
  }

  async sendMessage(homeserverUrl: string, accessToken: string, roomId: string, txnId: string, content: MatrixMessageContent): Promise<string> {
    const path = `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}`;
    const body = await this.call<{ event_id: string }>(homeserverUrl, 'PUT', path, accessToken, content);
    return body.event_id;
  }

  async roomSummary(homeserverUrl: string, accessToken: string, roomId: string): Promise<{ name: string | null; alias: string | null; joinedMembers: number }> {
    const room = `/rooms/${encodeURIComponent(roomId)}`;
    // A room without a name or an address answers 404 for that state: not an error here
    const state = <T>(type: string) => this.call<T>(homeserverUrl, 'GET', `${room}/state/${type}/`, accessToken).catch((error) => {
      if (error instanceof MatrixApiError && error.status === 404) return null;
      throw error;
    });
    const [name, alias, members] = await Promise.all([
      state<{ name?: string }>('m.room.name'),
      state<{ alias?: string }>('m.room.canonical_alias'),
      this.call<{ joined?: Record<string, unknown> }>(homeserverUrl, 'GET', `${room}/joined_members`, accessToken),
    ]);
    return { name: name?.name || null, alias: alias?.alias || null, joinedMembers: Object.keys(members.joined ?? {}).length };
  }

  async createRoom(homeserverUrl: string, accessToken: string, name: string): Promise<string> {
    // private_chat: invite only, history shared from the invitation; no encryption is asked for
    const body = await this.call<{ room_id: string }>(homeserverUrl, 'POST', '/createRoom', accessToken, {
      name,
      preset: 'private_chat',
      visibility: 'private',
    });
    return body.room_id;
  }

  async createDirectRoom(homeserverUrl: string, accessToken: string, userId: string, name: string): Promise<string> {
    // trusted_private_chat: invite only, both may change it, history shared from the invitation.
    // No initial m.room.encryption state is sent: notices stay readable by the helpdesk's plain HTTP client.
    const body = await this.call<{ room_id: string }>(homeserverUrl, 'POST', '/createRoom', accessToken, {
      name,
      preset: 'trusted_private_chat',
      visibility: 'private',
      is_direct: true,
      invite: [userId],
    });
    return body.room_id;
  }

  async membership(homeserverUrl: string, accessToken: string, roomId: string, userId: string): Promise<string | null> {
    try {
      const state = await this.call<{ membership?: string }>(homeserverUrl, 'GET', `/rooms/${encodeURIComponent(roomId)}/state/m.room.member/${encodeURIComponent(userId)}`, accessToken);
      return state.membership ?? null;
    } catch (error) {
      if (error instanceof MatrixApiError && error.status === 404) return null;
      throw error;
    }
  }

  async invite(homeserverUrl: string, accessToken: string, roomId: string, userId: string): Promise<void> {
    await this.call(homeserverUrl, 'POST', `/rooms/${encodeURIComponent(roomId)}/invite`, accessToken, { user_id: userId });
  }

  async leaveRoom(homeserverUrl: string, accessToken: string, roomId: string): Promise<void> {
    await this.call(homeserverUrl, 'POST', `/rooms/${encodeURIComponent(roomId)}/leave`, accessToken, {});
  }

  async powerLevels(homeserverUrl: string, accessToken: string, roomId: string): Promise<Record<string, unknown>> {
    return this.call(homeserverUrl, 'GET', `/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`, accessToken);
  }

  async setPowerLevels(homeserverUrl: string, accessToken: string, roomId: string, content: Record<string, unknown>): Promise<void> {
    await this.call(homeserverUrl, 'PUT', `/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`, accessToken, content);
  }

  async uploadMedia(homeserverUrl: string, accessToken: string, bytes: Buffer, mimeType: string, fileName: string): Promise<string> {
    const url = `${homeserverUrl.replace(/\/+$/, '')}/_matrix/media/v3/upload?filename=${encodeURIComponent(fileName)}`;
    const body = await this.request<{ content_uri: string }>(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': mimeType },
      body: new Uint8Array(bytes),
    }, UPLOAD_TIMEOUT_MS);
    return body.content_uri;
  }

  private async call<T>(homeserverUrl: string, method: string, path: string, accessToken: string | null, body?: unknown): Promise<T> {
    return this.request<T>(`${homeserverUrl.replace(/\/+$/, '')}/_matrix/client/v3${path}`, {
      method,
      headers: {
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, TIMEOUT_MS);
  }

  private async request<T>(url: string, init: Exchange, timeoutMs: number): Promise<T> {
    let answer: Answer;
    try {
      answer = await this.exchange(url, init, timeoutMs);
    } catch (error) {
      if (error instanceof PrivateNetworkUrlError) throw new MatrixApiError(-1, 'OHD_PRIVATE_NETWORK', error.message);
      throw new MatrixApiError(0, null, `The Matrix server did not answer: ${(error as Error).message}`);
    }
    let json: { errcode?: string; error?: string; retry_after_ms?: number } = {};
    try {
      json = JSON.parse(answer.text);
    } catch {
      // Not JSON: the status says what happened
    }
    if (answer.status < 200 || answer.status >= 300) {
      const retryAfter = json.retry_after_ms ?? (Number(answer.header('retry-after')) * 1000 || null);
      throw new MatrixApiError(answer.status, json.errcode ?? null, json.error ?? `HTTP ${answer.status}`, retryAfter);
    }
    return json as T;
  }

  /** One request, never following a redirect (it could take the token to another server). */
  private async exchange(url: string, init: Exchange, timeoutMs: number): Promise<Answer> {
    if (await this.limited(url)) {
      const response = await publicHttpRequest(url, { ...init, timeoutMs });
      if (response.status >= 300 && response.status < 400) throw new Error('the server answered with a redirect');
      return {
        status: response.status,
        text: response.body.toString('utf8'),
        header: (name) => [response.headers[name.toLowerCase()]].flat()[0] ?? null,
      };
    }
    const response = await fetch(url, { ...init, body: init.body as BodyInit | undefined, signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    return { status: response.status, text: await response.text(), header: (name) => response.headers.get(name) };
  }

  /** Whether this URL may only reach public addresses: any server but the installation bot's, when the installation asks. */
  private async limited(url: string): Promise<boolean> {
    if (privateNetworkUrlsAllowed()) return false;
    return new URL(url).host !== (await this.installationHost());
  }

  private async installationHost(): Promise<string | null> {
    if (this.trustedHost && this.trustedHost.until > Date.now()) return this.trustedHost.host;
    const bot = await this.botRepository.findInstallation();
    const host = bot ? new URL(bot.homeserverUrl).host : null;
    this.trustedHost = { host, until: Date.now() + TRUSTED_HOST_TTL_MS };
    return host;
  }
}
