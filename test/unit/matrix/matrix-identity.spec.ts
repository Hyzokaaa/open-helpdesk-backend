import { MatrixBot } from '../../../src/matrix/domain/entities/matrix-bot';
import { MatrixApiError } from '../../../src/matrix/domain/matrix-client';
import { parseMatrixUserId } from '../../../src/matrix/domain/matrix-user-id';
import { MATRIX_CODE_MAX_ATTEMPTS, MATRIX_CODES_PER_DAY } from '../../../src/matrix/domain/matrix-verification-code';
import { FindMatrixDirectBot } from '../../../src/matrix/domain/services/matrix-direct-bot-find';
import { OpenMatrixDirectRoom } from '../../../src/matrix/domain/services/matrix-direct-room-open';
import { CloseMatrixDirectRooms } from '../../../src/matrix/domain/services/matrix-direct-rooms-close';
import { StartMatrixIdentityVerification } from '../../../src/matrix/domain/services/matrix-identity-start';
import { VerifyMatrixIdentity } from '../../../src/matrix/domain/services/matrix-identity-verify';
import { DisconnectMatrixIdentity } from '../../../src/matrix/domain/services/matrix-identity-disconnect';
import { CancelMatrixIdentityChange } from '../../../src/matrix/domain/services/matrix-identity-change-cancel';
import { GetMyMatrixQuery } from '../../../src/matrix/application/queries/get-my-matrix.query';
import { FindMatrixSetup } from '../../../src/matrix/domain/services/matrix-setup-find';
import { ListMatrixDirectChats } from '../../../src/matrix/domain/services/matrix-direct-chats-list';
import { ReconnectMatrixDirectChat } from '../../../src/matrix/domain/services/matrix-direct-chat-reconnect';
import { MatrixDirectRoom } from '../../../src/matrix/domain/entities/matrix-direct-room';
import { Workspace } from '../../../src/workspace/domain/entities/workspace';
import { MockWorkspaceRepository } from '../../mocks/mock-workspace.repository';
import { ConflictError, DomainValidationError, TooManyRequestsError } from '../../../src/shared/domain/errors';
import { User } from '../../../src/user/domain/entities/user';
import { WorkspaceMember } from '../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockAuditLogRepository } from '../../mocks/mock-audit-log.repository';
import { MockUserRepository } from '../../mocks/mock-user.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';
import {
  FakeMatrixClient,
  FakeSecretCipher,
  MockMatrixBotRepository,
  MockMatrixDirectRoomRepository,
  MockMatrixIdentityRepository,
} from '../../mocks/mock-matrix';

const user = (id: string, isSystemAdmin = false) => new User({
  id, email: `${id}@acme.test`, password: 'hashed', firstName: id, lastName: 'Test',
  isActive: true, isSystemAdmin, isEmailVerified: true, language: 'es', theme: 'system',
});

const bot = (id: string, workspaceId: string | null, userId = `@${id}:example.org`) =>
  new MatrixBot({ id, workspaceId, homeserverUrl: 'https://m.example.org', userId, deviceId: null, encryptedAccessToken: 'enc:tok' });

describe('Reading a Matrix ID', () => {
  it('keeps a valid ID, trimmed', () => {
    expect(parseMatrixUserId('  @ana:example.org ')).toBe('@ana:example.org');
    expect(parseMatrixUserId('@ana.b-c_d:matrix.example.org:8448')).toBe('@ana.b-c_d:matrix.example.org:8448');
  });

  it.each(['ana', 'ana:example.org', '@ana', '@:example.org', '@ana:', '#room:example.org', '@ana:exa mple.org', `@${'a'.repeat(260)}:x.org`])('refuses %s', (value) => {
    expect(() => parseMatrixUserId(value)).toThrow(DomainValidationError);
  });
});

// Ana is an agent of ws-1, which writes with the installation's bot; Bob is only a customer.
describe('Connecting a user\'s Matrix account', () => {
  let client: FakeMatrixClient;
  let bots: MockMatrixBotRepository;
  let members: MockWorkspaceMemberRepository;
  let users: MockUserRepository;
  let identities: MockMatrixIdentityRepository;
  let directRooms: MockMatrixDirectRoomRepository;
  let audit: MockAuditLogRepository;
  let workspaces: MockWorkspaceRepository;
  let now: Date;

  const listChats = () => new ListMatrixDirectChats(bots, directRooms, members, workspaces, users);
  const myMatrix = (userId = 'ana') => new GetMyMatrixQuery(identities, findBot(), listChats(), new FindMatrixSetup(members, workspaces, users)).execute({ userId });
  const openRoom = () => new OpenMatrixDirectRoom(new FakeIdGenerator(), client, new FakeSecretCipher(), directRooms);
  const disconnect = () => new DisconnectMatrixIdentity(new FakeIdGenerator(), identities, closeRooms(), audit).execute('ana');
  const findBot = () => new FindMatrixDirectBot(bots, members, users);
  const closeRooms = () => new CloseMatrixDirectRooms(client, new FakeSecretCipher(), directRooms, bots);
  const start = (matrixUserId = '@ana:example.org', userId = 'ana') => new StartMatrixIdentityVerification(
    new FakeIdGenerator(), client, new FakeSecretCipher(), identities, bots, findBot(),
    new OpenMatrixDirectRoom(new FakeIdGenerator(), client, new FakeSecretCipher(), directRooms), closeRooms(), () => now,
  ).execute({ userId, matrixUserId, lang: 'es' });
  const verify = (code: string) => new VerifyMatrixIdentity(new FakeIdGenerator(), identities, audit, directRooms, closeRooms(), () => now).execute({ userId: 'ana', code });
  const cancelChange = () => new CancelMatrixIdentityChange(identities, closeRooms()).execute('ana');
  /** The code the bot last wrote in the chat. */
  const sentCode = () => /\b(\d{6})\b/.exec(String(client.sent.at(-1)?.content.body))?.[1] ?? '';
  const later = (ms: number) => { now = new Date(now.getTime() + ms); };

  beforeEach(async () => {
    client = new FakeMatrixClient();
    bots = new MockMatrixBotRepository();
    members = new MockWorkspaceMemberRepository();
    users = new MockUserRepository();
    identities = new MockMatrixIdentityRepository();
    directRooms = new MockMatrixDirectRoomRepository();
    audit = new MockAuditLogRepository();
    workspaces = new MockWorkspaceRepository();
    await workspaces.create(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    now = new Date('2026-11-15T10:00:00Z');
    users.seed(user('ana'));
    users.seed(user('bob'));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'ana', role: WorkspaceRole.AGENT }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'bob', role: WorkspaceRole.USER }));
    await bots.save(bot('helpdesk', null));
  });

  it('opens a direct chat with that account and sends a six-digit code there, in the user\'s language', async () => {
    const identity = await start();

    expect(client.directRooms).toEqual([{ roomId: '!direct-1:example.org', userId: '@ana:example.org', name: 'Avisos de Open Helpdesk' }]);
    expect(client.sent[0].roomId).toBe('!direct-1:example.org');
    expect(String(client.sent[0].content.body)).toMatch(/^Tu código de verificación de Open Helpdesk es \d{6}\. Caduca en 10 minutos/);
    expect(identity.verifiedAt).toBeNull();
    // Only a hash is kept
    expect(identity.codeHash).not.toContain(sentCode());
  });

  it('verifies the account with the right code, once', async () => {
    await start();
    const identity = await verify(sentCode());

    expect(identity.verifiedAt).toEqual(now);
    expect(identity.codeHash).toBeNull();
    expect(audit.entries.map((e) => e.action)).toEqual(['matrix-account-connected']);
    await expect(verify('123456')).rejects.toThrow('There is no code to check');
  });

  it('refuses a wrong code, and any code after too many wrong ones', async () => {
    await start();
    const code = sentCode();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 1; i < MATRIX_CODE_MAX_ATTEMPTS; i++) await expect(verify(wrong)).rejects.toThrow('That code is not right');
    await expect(verify(wrong)).rejects.toThrow('Too many wrong codes');
    await expect(verify(code)).rejects.toThrow('Too many wrong codes');
  });

  it('refuses a code that expired', async () => {
    await start();
    later(10 * 60 * 1000);
    await expect(verify(sentCode())).rejects.toThrow('The code expired');
  });

  it('spaces codes out and caps them per day, failed sends included', async () => {
    await start();
    await expect(start()).rejects.toThrow(TooManyRequestsError);

    client.createFailure = new MatrixApiError(403, 'M_FORBIDDEN', 'Not allowed');
    await directRooms.delete((await directRooms.findByUserId('ana'))[0].getId());
    for (let i = 1; i < MATRIX_CODES_PER_DAY; i++) {
      later(60 * 1000);
      await expect(start()).rejects.toThrow('The bot could not write to @ana:example.org: Not allowed');
    }
    later(60 * 1000);
    await expect(start()).rejects.toThrow('Too many codes today');
    later(24 * 60 * 60 * 1000);
    client.createFailure = null;
    await expect(start()).resolves.toBeDefined();
  });

  it('reuses the chat for a new code to the same account', async () => {
    await start();
    later(60 * 1000);
    await start();
    expect(client.directRooms).toHaveLength(1);
    expect(client.sent).toHaveLength(2);
  });

  describe('changing a verified account for another', () => {
    const verified = async () => {
      await start();
      await verify(sentCode());
      later(60 * 1000);
    };

    it('keeps the verified account and its chat until the new one is verified, and sends the code to a chat of its own', async () => {
      await verified();
      const identity = await start('@ana:other.org');

      expect(identity).toMatchObject({ matrixUserId: '@ana:example.org', pendingMatrixUserId: '@ana:other.org', pendingRoomId: '!direct-2:example.org' });
      expect(identity.verifiedAt).not.toBeNull();
      expect(client.left).toEqual([]);
      expect(directRooms.rooms.map((r) => [r.matrixUserId, r.roomId])).toEqual([['@ana:example.org', '!direct-1:example.org']]);
      expect(client.sent.at(-1)?.roomId).toBe('!direct-2:example.org');
      expect((await myMatrix()).identity).toEqual({
        matrixUserId: '@ana:example.org', status: 'verified', codeExpiresAt: '2026-11-15T10:11:00.000Z', pendingMatrixUserId: '@ana:other.org',
      });
    });

    it('switches once the code is typed: the old chat is left and the code\'s chat gets the notices', async () => {
      await verified();
      await start('@ana:other.org');
      const identity = await verify(sentCode());

      expect(identity).toMatchObject({ matrixUserId: '@ana:other.org', pendingMatrixUserId: null, pendingRoomId: null, pendingBotId: null });
      expect(client.left).toEqual(['!direct-1:example.org']);
      expect(directRooms.rooms.map((r) => [r.botId, r.matrixUserId, r.roomId])).toEqual([['helpdesk', '@ana:other.org', '!direct-2:example.org']]);
      expect(audit.entries.at(-1)?.metadata).toEqual({ matrixUserId: '@ana:other.org', previous: '@ana:example.org' });
    });

    it('reuses the code\'s chat for another code to the same ID, and leaves it for a different one', async () => {
      await verified();
      await start('@ana:other.org');
      later(60 * 1000);
      await start('@ana:other.org');
      expect(client.directRooms).toHaveLength(2);

      later(60 * 1000);
      const identity = await start('@ana:third.org');
      expect(client.left).toEqual(['!direct-2:example.org']);
      expect(identity).toMatchObject({ matrixUserId: '@ana:example.org', pendingMatrixUserId: '@ana:third.org', pendingRoomId: '!direct-3:example.org' });
    });

    it('can be given up: the bot leaves the code\'s chat and the verified account goes on', async () => {
      await verified();
      await start('@ana:other.org');
      const identity = await cancelChange();

      expect(identity).toMatchObject({ matrixUserId: '@ana:example.org', pendingMatrixUserId: null, codeHash: null });
      expect(identity?.verifiedAt).not.toBeNull();
      expect(client.left).toEqual(['!direct-2:example.org']);
      expect(directRooms.rooms.map((r) => r.roomId)).toEqual(['!direct-1:example.org']);
      await expect(verify('123456')).rejects.toMatchObject({ code: 'matrix-no-code' });
    });

    it('leaves the code\'s chat too on disconnecting', async () => {
      await verified();
      await start('@ana:other.org');
      await disconnect();
      expect(client.left.sort()).toEqual(['!direct-1:example.org', '!direct-2:example.org']);
      expect((await myMatrix()).identity).toBeNull();
    });
  });

  it('does not send a code to an account already connected', async () => {
    await start();
    await verify(sentCode());
    later(60 * 1000);
    await expect(start()).rejects.toThrow(ConflictError);
  });

  it('refuses the bot\'s own Matrix ID', async () => {
    await expect(start('@HelpDesk:example.org')).rejects.toThrow('That is the helpdesk\'s own bot');
    expect(client.directRooms).toEqual([]);
  });

  it('is not offered to customers, nor where no bot can write', async () => {
    await expect(start('@bob:example.org', 'bob')).rejects.toThrow('Matrix notices are not set up');
    expect(await myMatrix('bob')).toEqual({ available: false, botUserId: null, identity: null, chats: [], setup: null });

    await bots.delete('helpdesk');
    await expect(start()).rejects.toThrow('Matrix notices are not set up');
  });

  it('tells the team where a bot could be connected when there is none, and a customer nothing', async () => {
    await bots.delete('helpdesk');
    await workspaces.create(new Workspace({ id: 'ws-2', name: 'Beta', slug: 'beta', description: '' }));
    members.seed(new WorkspaceMember({ id: 'm-3', workspaceId: 'ws-2', userId: 'ana', role: WorkspaceRole.ADMIN }));

    expect((await myMatrix()).setup).toEqual({ workspaces: [{ slug: 'beta', name: 'Beta' }], installation: false });
    expect((await myMatrix('bob')).setup).toBeNull();

    users.seed(user('root', true));
    expect((await myMatrix('root')).setup).toEqual({ workspaces: [], installation: true });
  });

  it('tells the user which bot to expect and how far they got', async () => {
    await start();
    expect(await myMatrix()).toEqual({
      available: true,
      botUserId: '@helpdesk:example.org',
      identity: { matrixUserId: '@ana:example.org', status: 'pending', codeExpiresAt: '2026-11-15T10:10:00.000Z', pendingMatrixUserId: null },
      chats: [{ botId: 'helpdesk', botUserId: '@helpdesk:example.org', workspaces: ['Acme'], paused: false }],
      setup: null,
    });
  });

  it('forgets the account on disconnecting: the bots leave its chats', async () => {
    await start();
    await verify(sentCode());
    await disconnect();

    expect((await myMatrix()).identity).toBeNull();
    expect(directRooms.rooms).toEqual([]);
    expect(client.left).toEqual(['!direct-1:example.org']);
    expect(audit.entries.map((e) => [e.action, e.metadata])).toEqual([
      ['matrix-account-connected', { matrixUserId: '@ana:example.org' }],
      ['matrix-account-disconnected', { matrixUserId: '@ana:example.org' }],
    ]);
  });

  it('keeps the code limits when the account is disconnected and connected again', async () => {
    await start();
    await disconnect();
    await expect(start()).rejects.toThrow('A code was just sent');

    for (let i = 1; i < MATRIX_CODES_PER_DAY; i++) {
      later(60 * 1000);
      await start(`@ana${i}:example.org`);
      await disconnect();
    }
    later(60 * 1000);
    await expect(start('@someone:example.org')).rejects.toThrow('Too many codes today');
  });

  it('counts every try, also those sent at the same time', async () => {
    await start();
    const code = sentCode();
    const wrong = code === '000000' ? '111111' : '000000';
    const tries = await Promise.allSettled(Array.from({ length: 10 }, () => verify(wrong)));

    expect(tries.every((t) => t.status === 'rejected')).toBe(true);
    expect((await identities.findByUserId('ana'))?.codeAttempts).toBe(MATRIX_CODE_MAX_ATTEMPTS);
    await expect(verify(code)).rejects.toThrow('Too many wrong codes');
  });

  it('invites the user again when they rejected or left the chat of an earlier code', async () => {
    await start();
    client.memberships['!direct-1:example.org'] = { '@ana:example.org': 'leave' };
    later(60 * 1000);
    await start();

    expect(client.directRooms.map((r) => r.roomId)).toEqual(['!direct-1:example.org', '!direct-2:example.org']);
    expect(client.left).toEqual(['!direct-1:example.org']);
    expect(client.sent.at(-1)?.roomId).toBe('!direct-2:example.org');
  });

  it('tells a customer nothing about the bots\' IDs', async () => {
    await expect(start('@helpdesk:example.org', 'bob')).rejects.toThrow('Matrix notices are not set up');
  });

  it('answers with stable codes the app can show in the user\'s language', async () => {
    await expect(start('ana')).rejects.toMatchObject({ code: 'matrix-invalid-id' });
    await expect(start('@helpdesk:example.org')).rejects.toMatchObject({ code: 'matrix-is-bot' });
    await expect(verify('123456')).rejects.toMatchObject({ code: 'matrix-no-code' });
    await start();
    await expect(start()).rejects.toMatchObject({ code: 'matrix-too-soon' });
  });

  it('keeps the chat another request opened at the same time, and leaves its own', async () => {
    const racing = new MatrixDirectRoom({ id: 'other', botId: 'helpdesk', userId: 'ana', matrixUserId: '@ana:example.org', roomId: '!theirs:example.org', lostAt: null });
    const find = directRooms.find.bind(directRooms);
    let first = true;
    directRooms.find = async (botId, userId) => {
      if (!first) return find(botId, userId);
      first = false;
      await directRooms.save(racing);
      return null;
    };

    const room = await openRoom().execute({ bot: (await bots.findById('helpdesk'))!, userId: 'ana', matrixUserId: '@ana:example.org', lang: null });
    expect(room.roomId).toBe('!theirs:example.org');
    expect(client.left).toEqual(['!direct-1:example.org']);
  });

  it('reconnects one bot\'s paused chat without a new code', async () => {
    await start();
    await verify(sentCode());
    const room = (await directRooms.find('helpdesk', 'ana'))!;
    room.lostAt = now;
    await directRooms.save(room);
    expect((await myMatrix()).chats[0].paused).toBe(true);

    await new ReconnectMatrixDirectChat(client, new FakeSecretCipher(), identities, listChats(), openRoom()).execute({ userId: 'ana', botId: 'helpdesk', lang: 'es' });

    expect((await myMatrix()).chats[0].paused).toBe(false);
    expect(client.directRooms.map((r) => r.roomId)).toEqual(['!direct-1:example.org', '!direct-2:example.org']);
    expect(String(client.sent.at(-1)?.content.body)).toBe('Tus avisos de Open Helpdesk de este bot siguen en este chat.');
    await expect(new ReconnectMatrixDirectChat(client, new FakeSecretCipher(), identities, listChats(), openRoom()).execute({ userId: 'ana', botId: 'someone-else', lang: 'es' }))
      .rejects.toThrow('That bot does not write to you');
  });
});

describe('Listing the bots that write to a user', () => {
  it('names each bot once, with the workspaces it writes for', async () => {
    const bots = new MockMatrixBotRepository();
    const members = new MockWorkspaceMemberRepository();
    const workspaces = new MockWorkspaceRepository();
    const users = new MockUserRepository();
    users.seed(user('ana'));
    await bots.save(bot('helpdesk', null));
    await bots.save(bot('globex-bot', 'ws-3'));
    for (const [id, name] of [['ws-1', 'Acme'], ['ws-2', 'Initech'], ['ws-3', 'Globex'], ['ws-4', 'Hooli']]) {
      await workspaces.create(new Workspace({ id, name, slug: id, description: '' }));
    }
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-2', userId: 'ana', role: WorkspaceRole.AGENT }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'ana', role: WorkspaceRole.ADMIN }));
    members.seed(new WorkspaceMember({ id: 'm-3', workspaceId: 'ws-3', userId: 'ana', role: WorkspaceRole.SUPERVISOR }));
    // A customer there: no notices
    members.seed(new WorkspaceMember({ id: 'm-4', workspaceId: 'ws-4', userId: 'ana', role: WorkspaceRole.USER }));

    const chats = await new ListMatrixDirectChats(bots, new MockMatrixDirectRoomRepository(), members, workspaces, users).execute('ana');
    expect(chats.map((c) => [c.bot.userId, c.workspaceNames])).toEqual([
      ['@helpdesk:example.org', ['Acme', 'Initech']],
      ['@globex-bot:example.org', ['Globex']],
    ]);
  });
});

describe('Choosing the bot that verifies a user\'s account', () => {
  let bots: MockMatrixBotRepository;
  let members: MockWorkspaceMemberRepository;
  let users: MockUserRepository;
  const find = (userId: string) => new FindMatrixDirectBot(bots, members, users).execute(userId);

  beforeEach(() => {
    bots = new MockMatrixBotRepository();
    members = new MockWorkspaceMemberRepository();
    users = new MockUserRepository();
    users.seed(user('ana'));
    users.seed(user('root', true));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'ana', role: WorkspaceRole.AGENT }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-2', userId: 'ana', role: WorkspaceRole.ADMIN }));
  });

  it('takes the installation\'s bot when one of the user\'s workspaces uses it', async () => {
    await bots.save(bot('own-1', 'ws-1'));
    await bots.save(bot('helpdesk', null));
    expect((await find('ana'))?.getId()).toBe('helpdesk');
  });

  it('takes a workspace\'s own bot when every workspace of the user has one', async () => {
    await bots.save(bot('own-1', 'ws-1'));
    await bots.save(bot('own-2', 'ws-2'));
    await bots.save(bot('helpdesk', null));
    expect((await find('ana'))?.getId()).toBe('own-1');
  });

  it('takes the installation\'s bot for a system admin on no team', async () => {
    await bots.save(bot('helpdesk', null));
    expect((await find('root'))?.getId()).toBe('helpdesk');
  });

  it('answers none when no bot can write for the user', async () => {
    expect(await find('ana')).toBeNull();
  });
});
