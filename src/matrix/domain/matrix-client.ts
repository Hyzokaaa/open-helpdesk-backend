/** The content of an m.room.message event. */
export type MatrixMessageContent = Record<string, unknown>;

export interface MatrixLogin {
  accessToken: string;
  userId: string;
  deviceId: string | null;
}

/** The Matrix client-server API calls the helpdesk makes, over plain HTTP. */
export interface MatrixClient {
  /** The homeserver a server name delegates to (.well-known/matrix/client), or null. */
  discoverHomeserver(serverName: string): Promise<string | null>;
  login(homeserverUrl: string, user: string, password: string, deviceName: string): Promise<MatrixLogin>;
  whoami(homeserverUrl: string, accessToken: string): Promise<{ userId: string; deviceId: string | null }>;
  /** Ends the session: the token stops working. */
  logout(homeserverUrl: string, accessToken: string): Promise<void>;
  resolveRoomAlias(homeserverUrl: string, accessToken: string, alias: string): Promise<string>;
  /** Joins (or accepts the invitation to) a room; answers its ID. */
  joinRoom(homeserverUrl: string, accessToken: string, roomIdOrAlias: string): Promise<string>;
  /** Sends a message; the same txnId never posts twice. Answers the event ID. */
  sendMessage(homeserverUrl: string, accessToken: string, roomId: string, txnId: string, content: MatrixMessageContent): Promise<string>;
  /** The name, address and joined members of a room the bot is in. */
  roomSummary(homeserverUrl: string, accessToken: string, roomId: string): Promise<{ name: string | null; alias: string | null; joinedMembers: number }>;
  /** Creates a private, invite-only room the bot is in; answers its ID. Nobody is invited yet. */
  createRoom(homeserverUrl: string, accessToken: string, name: string): Promise<string>;
  /** Opens a direct chat with a user: private, unencrypted, the user invited. Answers its ID. */
  createDirectRoom(homeserverUrl: string, accessToken: string, userId: string, name: string): Promise<string>;
  /** Where a user stands in a room the bot is in: join, invite, leave, ban…; null when they never were in it. */
  membership(homeserverUrl: string, accessToken: string, roomId: string, userId: string): Promise<string | null>;
  invite(homeserverUrl: string, accessToken: string, roomId: string, userId: string): Promise<void>;
  leaveRoom(homeserverUrl: string, accessToken: string, roomId: string): Promise<void>;
  /** The room's m.room.power_levels content. */
  powerLevels(homeserverUrl: string, accessToken: string, roomId: string): Promise<Record<string, unknown>>;
  setPowerLevels(homeserverUrl: string, accessToken: string, roomId: string, content: Record<string, unknown>): Promise<void>;
  /** Uploads a file to the homeserver's media store; answers its mxc:// URI. */
  uploadMedia(homeserverUrl: string, accessToken: string, bytes: Buffer, mimeType: string, fileName: string): Promise<string>;
}

/** An answer of the homeserver other than success, or no answer at all (status 0). */
export class MatrixApiError extends Error {
  constructor(
    readonly status: number,
    readonly errcode: string | null,
    message: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
  }

  /** The token no longer works, or the bot may not write in the room. */
  get lostAccess(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** Worth sending again: rate limited, the server failed, or it did not answer. */
  get retryable(): boolean {
    return this.status === 429 || this.status === 0 || this.status >= 500;
  }
}
