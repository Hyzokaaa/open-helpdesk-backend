import { ConflictError } from '../../src/shared/domain/errors';
import { MatrixBot } from '../../src/matrix/domain/entities/matrix-bot';
import { MatrixRoom } from '../../src/matrix/domain/entities/matrix-room';
import { MatrixTicketThread } from '../../src/matrix/domain/entities/matrix-ticket-thread';
import { MatrixIdentity } from '../../src/matrix/domain/entities/matrix-identity';
import { MatrixDirectRoom } from '../../src/matrix/domain/entities/matrix-direct-room';
import { MatrixRoomCreation } from '../../src/matrix/domain/entities/matrix-room-creation';
import { MatrixRoomCreationRepository } from '../../src/matrix/domain/repositories/matrix-room-creation.repository';
import { MatrixIdentityRepository } from '../../src/matrix/domain/repositories/matrix-identity.repository';
import { MatrixDirectRoomRepository } from '../../src/matrix/domain/repositories/matrix-direct-room.repository';
import { MatrixApiError, MatrixClient, MatrixLogin, MatrixMessageContent } from '../../src/matrix/domain/matrix-client';
import { MatrixFileSource, MatrixNoticeFile } from '../../src/matrix/domain/matrix-notice-files';
import { MatrixBotRepository } from '../../src/matrix/domain/repositories/matrix-bot.repository';
import { MatrixRoomRepository } from '../../src/matrix/domain/repositories/matrix-room.repository';
import { MatrixTicketThreadRepository } from '../../src/matrix/domain/repositories/matrix-ticket-thread.repository';
import { SecretCipher } from '../../src/shared/domain/secret-cipher';

export class MockMatrixBotRepository implements MatrixBotRepository {
  bots: MatrixBot[] = [];

  async findInstallation(): Promise<MatrixBot | null> {
    return this.bots.find((b) => b.workspaceId === null) ?? null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<MatrixBot | null> {
    return this.bots.find((b) => b.workspaceId === workspaceId) ?? null;
  }

  async findById(id: string): Promise<MatrixBot | null> {
    return this.bots.find((b) => b.getId() === id) ?? null;
  }

  async findAll(): Promise<MatrixBot[]> {
    return this.bots;
  }

  async save(bot: MatrixBot): Promise<void> {
    this.bots = [...this.bots.filter((b) => b.getId() !== bot.getId()), bot];
  }

  async delete(id: string): Promise<void> {
    this.bots = this.bots.filter((b) => b.getId() !== id);
  }
}

export class MockMatrixRoomRepository implements MatrixRoomRepository {
  rooms: MatrixRoom[] = [];

  async findById(id: string): Promise<MatrixRoom | null> {
    return this.rooms.find((r) => r.getId() === id) ?? null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<MatrixRoom[]> {
    return this.rooms.filter((r) => r.workspaceId === workspaceId);
  }

  async findByRoomId(roomId: string): Promise<MatrixRoom[]> {
    return this.rooms.filter((r) => r.roomId === roomId);
  }

  /** Workspaces with a bot of their own, as matrix_bots would tell. */
  workspacesWithOwnBot: string[] = [];

  async findForInstallationBot(): Promise<MatrixRoom[]> {
    return this.rooms.filter((r) => !this.workspacesWithOwnBot.includes(r.workspaceId));
  }

  async save(room: MatrixRoom): Promise<void> {
    this.rooms = [...this.rooms.filter((r) => r.getId() !== room.getId()), room];
  }

  async delete(id: string): Promise<void> {
    this.rooms = this.rooms.filter((r) => r.getId() !== id);
  }
}

export class MockMatrixTicketThreadRepository implements MatrixTicketThreadRepository {
  threads: MatrixTicketThread[] = [];

  async find(ticketId: string, roomId: string): Promise<MatrixTicketThread | null> {
    return this.threads.find((t) => t.ticketId === ticketId && t.roomId === roomId) ?? null;
  }

  async save(thread: MatrixTicketThread): Promise<void> {
    this.threads = [...this.threads.filter((t) => !(t.ticketId === thread.ticketId && t.roomId === thread.roomId)), thread];
  }
}

export class MockMatrixIdentityRepository implements MatrixIdentityRepository {
  identities: MatrixIdentity[] = [];

  async findByUserId(userId: string): Promise<MatrixIdentity | null> {
    return this.identities.find((i) => i.userId === userId) ?? null;
  }

  async findByUserIds(userIds: string[]): Promise<MatrixIdentity[]> {
    return this.identities.filter((i) => userIds.includes(i.userId));
  }

  async save(identity: MatrixIdentity): Promise<void> {
    this.identities = [...this.identities.filter((i) => i.getId() !== identity.getId()), identity];
  }

  async claimCodeAttempt(id: string, max: number): Promise<number | null> {
    const identity = this.identities.find((i) => i.getId() === id);
    if (!identity || identity.codeAttempts >= max) return null;
    return ++identity.codeAttempts;
  }
}

export class MockMatrixDirectRoomRepository implements MatrixDirectRoomRepository {
  rooms: MatrixDirectRoom[] = [];

  async find(botId: string, userId: string): Promise<MatrixDirectRoom | null> {
    return this.rooms.find((r) => r.botId === botId && r.userId === userId) ?? null;
  }

  async findByUserId(userId: string): Promise<MatrixDirectRoom[]> {
    return this.rooms.filter((r) => r.userId === userId);
  }

  async findByBotId(botId: string): Promise<MatrixDirectRoom[]> {
    return this.rooms.filter((r) => r.botId === botId);
  }

  async save(room: MatrixDirectRoom): Promise<void> {
    // UNIQUE(botId, userId), as in the database
    if (this.rooms.some((r) => r.botId === room.botId && r.userId === room.userId && r.getId() !== room.getId())) {
      throw new ConflictError('The bot already has a direct chat with this user');
    }
    this.rooms = [...this.rooms.filter((r) => r.getId() !== room.getId()), room];
  }

  async delete(id: string): Promise<void> {
    this.rooms = this.rooms.filter((r) => r.getId() !== id);
  }
}

export class MockMatrixRoomCreationRepository implements MatrixRoomCreationRepository {
  creations: MatrixRoomCreation[] = [];

  async create(creation: MatrixRoomCreation): Promise<void> {
    this.creations.push(creation);
  }

  async countSince(workspaceId: string, since: Date): Promise<number> {
    return this.creations.filter((c) => c.workspaceId === workspaceId && c.createdAt >= since).length;
  }

  async delete(id: string): Promise<void> {
    this.creations = this.creations.filter((c) => c.getId() !== id);
  }

  async deleteBefore(workspaceId: string, before: Date): Promise<void> {
    this.creations = this.creations.filter((c) => c.workspaceId !== workspaceId || c.createdAt >= before);
  }
}

/** Reversible and readable: "enc:<value>"; anything else does not decrypt. */
export class FakeSecretCipher implements SecretCipher {
  encrypt(plain: string): string {
    return `enc:${plain}`;
  }

  decrypt(stored: string): string | null {
    return stored.startsWith('enc:') ? stored.slice(4) : null;
  }
}

/** A homeserver in memory: records calls, and fails as the test asks. */
export class FakeMatrixClient implements MatrixClient {
  readonly sent: Array<{ homeserverUrl: string; token: string; roomId: string; txnId: string; content: MatrixMessageContent }> = [];
  readonly loggedOut: string[] = [];
  readonly logins: Array<{ homeserverUrl: string; user: string; password: string }> = [];
  wellKnown: Record<string, string> = {};
  /** token → user ID */
  tokens: Record<string, string> = {};
  /** user ID → password */
  passwords: Record<string, string> = {};
  /** room or alias → room ID, for rooms the bot may join */
  joinable: Record<string, string> = {};
  /** Errors the next sends throw, in order. */
  sendFailures: MatrixApiError[] = [];
  private events = 0;

  async discoverHomeserver(serverName: string): Promise<string | null> {
    return this.wellKnown[serverName] ?? null;
  }

  async login(homeserverUrl: string, user: string, password: string): Promise<MatrixLogin> {
    this.logins.push({ homeserverUrl, user, password });
    if (this.passwords[user] !== password) throw new MatrixApiError(403, 'M_FORBIDDEN', 'Invalid username or password');
    const token = `token-${this.logins.length}`;
    this.tokens[token] = user;
    return { accessToken: token, userId: user, deviceId: `DEVICE${this.logins.length}` };
  }

  async whoami(_homeserverUrl: string, accessToken: string): Promise<{ userId: string; deviceId: string | null }> {
    const userId = this.tokens[accessToken];
    if (!userId) throw new MatrixApiError(401, 'M_UNKNOWN_TOKEN', 'Unknown token');
    return { userId, deviceId: null };
  }

  async logout(_homeserverUrl: string, accessToken: string): Promise<void> {
    this.loggedOut.push(accessToken);
    delete this.tokens[accessToken];
  }

  async resolveRoomAlias(_homeserverUrl: string, _accessToken: string, alias: string): Promise<string> {
    const roomId = this.joinable[alias];
    if (!roomId) throw new MatrixApiError(404, 'M_NOT_FOUND', 'Room alias not found');
    return roomId;
  }

  /** room ID → who is in it or invited: only they may join it, and only those in it may invite */
  inviteOnly: Record<string, string[]> = {};
  /** Room IDs a bot joined, in order. */
  joined: string[] = [];

  async joinRoom(_homeserverUrl: string, accessToken: string, roomIdOrAlias: string): Promise<string> {
    if (!this.tokens[accessToken]) throw new MatrixApiError(401, 'M_UNKNOWN_TOKEN', 'Unknown token');
    const members = this.inviteOnly[roomIdOrAlias];
    if (members) {
      if (!members.includes(this.tokens[accessToken])) throw new MatrixApiError(403, 'M_FORBIDDEN', 'You are not invited to this room.');
      this.joined.push(roomIdOrAlias);
      return roomIdOrAlias;
    }
    const roomId = this.joinable[roomIdOrAlias];
    if (!roomId) throw new MatrixApiError(403, 'M_FORBIDDEN', 'You are not invited to this room.');
    this.joined.push(roomId);
    return roomId;
  }

  async sendMessage(homeserverUrl: string, token: string, roomId: string, txnId: string, content: MatrixMessageContent): Promise<string> {
    const failure = this.sendFailures.shift();
    if (failure) throw failure;
    this.sent.push({ homeserverUrl, token, roomId, txnId, content });
    return `$event-${++this.events}`;
  }

  /** room ID → what the room shows the bot; a room missing here cannot be read */
  summaries: Record<string, { name: string | null; alias: string | null; joinedMembers: number }> = {};

  async roomSummary(_homeserverUrl: string, _token: string, roomId: string): Promise<{ name: string | null; alias: string | null; joinedMembers: number }> {
    const summary = this.summaries[roomId];
    if (!summary) throw new MatrixApiError(500, null, 'Internal error');
    return summary;
  }

  /** Rooms the bot created, with who it invited and the power levels it set. */
  readonly created: Array<{ roomId: string; name: string; invited: string[]; powerLevels: Record<string, unknown> }> = [];
  /** Answers createRoom with this error, when set. */
  createFailure: MatrixApiError | null = null;
  /** user ID → error its invitation gets */
  inviteFailures: Record<string, MatrixApiError> = {};
  /** Answers setPowerLevels with this error, when set. */
  powerLevelsFailure: MatrixApiError | null = null;

  async createRoom(_homeserverUrl: string, accessToken: string, name: string): Promise<string> {
    if (this.createFailure) throw this.createFailure;
    const roomId = `!created-${this.created.length + 1}:example.org`;
    this.created.push({ roomId, name, invited: [], powerLevels: { users: { [this.tokens[accessToken]]: 100 }, users_default: 0, events_default: 0 } });
    this.joinable[roomId] = roomId;
    return roomId;
  }

  /** Direct chats the bot opened, with the user it invited. */
  readonly directRooms: Array<{ roomId: string; userId: string; name: string }> = [];
  /** room ID → user ID → membership; a user missing here is invited (in a direct chat) or never was. */
  memberships: Record<string, Record<string, string>> = {};

  async createDirectRoom(_homeserverUrl: string, _accessToken: string, userId: string, name: string): Promise<string> {
    if (this.createFailure) throw this.createFailure;
    const roomId = `!direct-${this.directRooms.length + 1}:example.org`;
    this.directRooms.push({ roomId, userId, name });
    return roomId;
  }

  /** room ID → error reading memberships there (403 M_FORBIDDEN: the bot is not in the room) */
  membershipFailures: Record<string, MatrixApiError> = {};

  async membership(_homeserverUrl: string, _token: string, roomId: string, userId: string): Promise<string | null> {
    if (this.membershipFailures[roomId]) throw this.membershipFailures[roomId];
    const set = this.memberships[roomId]?.[userId];
    if (set !== undefined) return set;
    return this.directRooms.some((r) => r.roomId === roomId && r.userId === userId) ? 'invite' : null;
  }

  async invite(_homeserverUrl: string, token: string, roomId: string, userId: string): Promise<void> {
    if (this.inviteFailures[userId]) throw this.inviteFailures[userId];
    const members = this.inviteOnly[roomId];
    if (members) {
      if (!this.tokens[token]) throw new MatrixApiError(401, 'M_UNKNOWN_TOKEN', 'Unknown token');
      if (!members.includes(this.tokens[token])) throw new MatrixApiError(403, 'M_FORBIDDEN', 'You are not in the room');
      members.push(userId);
      return;
    }
    this.createdRoom(roomId).invited.push(userId);
  }

  /** Rooms the bot left. */
  readonly left: string[] = [];
  /** Answers leaveRoom with this error, when set. */
  leaveFailure: MatrixApiError | null = null;

  async leaveRoom(_homeserverUrl: string, _token: string, roomId: string): Promise<void> {
    if (this.leaveFailure) throw this.leaveFailure;
    this.left.push(roomId);
  }

  async powerLevels(_homeserverUrl: string, _token: string, roomId: string): Promise<Record<string, unknown>> {
    return structuredClone(this.createdRoom(roomId).powerLevels);
  }

  async setPowerLevels(_homeserverUrl: string, _token: string, roomId: string, content: Record<string, unknown>): Promise<void> {
    if (this.powerLevelsFailure) throw this.powerLevelsFailure;
    this.createdRoom(roomId).powerLevels = content;
  }

  private createdRoom(roomId: string) {
    const room = this.created.find((r) => r.roomId === roomId);
    if (!room) throw new MatrixApiError(404, 'M_NOT_FOUND', 'Unknown room');
    return room;
  }

  readonly uploads: Array<{ fileName: string; mimeType: string; bytes: Buffer }> = [];
  /** Errors the next uploads throw, in order. */
  uploadFailures: MatrixApiError[] = [];

  async uploadMedia(_homeserverUrl: string, _token: string, bytes: Buffer, mimeType: string, fileName: string): Promise<string> {
    const failure = this.uploadFailures.shift();
    if (failure) throw failure;
    this.uploads.push({ fileName, mimeType, bytes });
    return `mxc://example.org/${this.uploads.length}`;
  }
}

/** Ticket and reply files in memory; a file without bytes cannot be read. */
export class FakeMatrixFileSource implements MatrixFileSource {
  private readonly files: Array<MatrixNoticeFile & { ticketId: string; commentId: string | null; bytes: Buffer | null }> = [];

  add(ticketId: string, commentId: string | null, file: Partial<MatrixNoticeFile> & { id: string }, bytes: Buffer | null = Buffer.from('bytes')): void {
    this.files.push({ name: `${file.id}.png`, mimeType: 'image/png', size: 5, ...file, ticketId, commentId, bytes });
  }

  async list(ticketId: string, commentId: string | null): Promise<MatrixNoticeFile[]> {
    return this.files
      .filter((f) => f.ticketId === ticketId && f.commentId === commentId)
      .map(({ id, name, mimeType, size }) => ({ id, name, mimeType, size }));
  }

  async read(file: MatrixNoticeFile): Promise<Buffer> {
    const bytes = this.files.find((f) => f.id === file.id)?.bytes;
    if (!bytes) throw new Error('not in storage');
    return bytes;
  }
}
