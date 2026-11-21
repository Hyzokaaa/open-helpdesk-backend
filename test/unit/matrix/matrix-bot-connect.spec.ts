import { ConnectMatrixBot, matrixServerName } from '../../../src/matrix/domain/services/matrix-bot-connect';
import { DisconnectMatrixBot } from '../../../src/matrix/domain/services/matrix-bot-disconnect';
import { ResolveMatrixBot } from '../../../src/matrix/domain/services/matrix-bot-resolve';
import { MatrixBot } from '../../../src/matrix/domain/entities/matrix-bot';
import { DomainValidationError } from '../../../src/shared/domain/errors';
import { PrivateNetworkUrlError } from '../../../src/shared/infrastructure/private-network';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { HandOverMatrixRooms } from '../../../src/matrix/domain/services/matrix-rooms-hand-over';
import { MatrixRoom } from '../../../src/matrix/domain/entities/matrix-room';
import { MatrixNoticeEvent } from '../../../src/matrix/domain/enums/matrix-notice-event.enum';
import { MatrixDirectRoom } from '../../../src/matrix/domain/entities/matrix-direct-room';
import { CloseMatrixDirectRooms } from '../../../src/matrix/domain/services/matrix-direct-rooms-close';
import { FakeMatrixClient, FakeSecretCipher, MockMatrixBotRepository, MockMatrixDirectRoomRepository, MockMatrixRoomRepository } from '../../mocks/mock-matrix';

describe('Connecting a Matrix bot', () => {
  let bots: MockMatrixBotRepository;
  let rooms: MockMatrixRoomRepository;
  let directRooms: MockMatrixDirectRoomRepository;
  let client: FakeMatrixClient;
  let reached: string[];
  let ids: FakeIdGenerator;
  const cipher = new FakeSecretCipher();
  const service = (ensureReachable = async (url: string) => { reached.push(url); }) =>
    new ConnectMatrixBot(ids, bots, client, cipher, ensureReachable, new HandOverMatrixRooms(rooms, client, directRooms));
  const connect = (ensureReachable?: (url: string) => Promise<void>) =>
    ({ execute: async (p: Parameters<ConnectMatrixBot['execute']>[0]) => (await service(ensureReachable).execute(p)).bot });

  beforeEach(() => {
    ids = new FakeIdGenerator('bot');
    bots = new MockMatrixBotRepository();
    rooms = new MockMatrixRoomRepository();
    directRooms = new MockMatrixDirectRoomRepository();
    client = new FakeMatrixClient();
    client.wellKnown['example.org'] = 'https://matrix.example.org';
    client.passwords['@helpdesk:example.org'] = 'secret';
    reached = [];
  });

  it('finds the homeserver, logs in once, and keeps only the encrypted token', async () => {
    const bot = await connect().execute({ workspaceId: null, userId: '@helpdesk:example.org', password: 'secret' });

    expect(client.logins).toEqual([{ homeserverUrl: 'https://matrix.example.org', user: '@helpdesk:example.org', password: 'secret' }]);
    expect(bot.homeserverUrl).toBe('https://matrix.example.org');
    expect(bot.encryptedAccessToken).toBe('enc:token-1');
    expect(bot.deviceId).toBe('DEVICE1');
    expect(JSON.stringify(bots.bots)).not.toContain('secret');
    expect(await bots.findInstallation()).toBe(bot);
  });

  it('checks every server it is about to call against the scope\'s rule', async () => {
    await connect().execute({ workspaceId: 'ws-1', userId: '@helpdesk:example.org', password: 'secret' });
    expect(reached).toEqual(['https://example.org', 'https://matrix.example.org']);

    const refuse = async () => { throw new PrivateNetworkUrlError(); };
    await expect(connect(refuse).execute({ workspaceId: 'ws-1', userId: '@helpdesk:example.org', password: 'secret' })).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    expect(client.logins).toHaveLength(1);
  });

  it('uses the server name itself when it delegates nowhere, or the address typed', async () => {
    client.passwords['@bot:plain.org'] = 'pw';
    expect((await connect().execute({ workspaceId: null, userId: '@bot:plain.org', password: 'pw' })).homeserverUrl).toBe('https://plain.org');
    expect((await connect().execute({ workspaceId: 'ws-1', userId: '@bot:plain.org', password: 'pw', homeserverUrl: 'http://10.0.0.5:8008/' })).homeserverUrl).toBe('http://10.0.0.5:8008');
  });

  it("refuses plain http on the internet, also when the server's .well-known points to it", async () => {
    client.passwords['@bot:plain.org'] = 'pw';
    await expect(connect().execute({ workspaceId: 'ws-1', userId: '@bot:plain.org', password: 'pw', homeserverUrl: 'http://matrix.plain.org' })).rejects.toMatchObject({ code: 'matrix-https-required' });
    await expect(connect().execute({ workspaceId: 'ws-1', userId: '@bot:plain.org', password: 'pw', homeserverUrl: 'http://8.8.8.8:8008' })).rejects.toMatchObject({ code: 'matrix-https-required' });
    client.wellKnown['plain.org'] = 'http://matrix.plain.org';
    await expect(connect().execute({ workspaceId: 'ws-1', userId: '@bot:plain.org', password: 'pw' })).rejects.toMatchObject({ code: 'matrix-https-required' });
    // Nothing was sent to the server: not even the password
    expect(client.logins).toEqual([]);

    // A server on this machine or on the private network, written as its address
    for (const url of ['http://localhost:8008', 'http://127.0.0.1:8008', 'http://192.168.1.10:8008', 'http://[::1]:8008']) {
      await expect(connect().execute({ workspaceId: 'ws-1', userId: '@bot:plain.org', password: 'pw', homeserverUrl: url })).resolves.toBeDefined();
    }
  });

  it('accepts an access token instead, after checking whose it is', async () => {
    client.tokens['syt_given'] = '@helpdesk:example.org';
    const bot = await connect().execute({ workspaceId: 'ws-1', userId: '@helpdesk:example.org', accessToken: ' syt_given ' });
    expect(bot.encryptedAccessToken).toBe('enc:syt_given');
    expect(client.logins).toEqual([]);

    client.tokens['syt_other'] = '@someone:example.org';
    await expect(connect().execute({ workspaceId: 'ws-1', userId: '@helpdesk:example.org', accessToken: 'syt_other' })).rejects.toThrow('belongs to @someone:example.org');
  });

  it('explains a wrong password, a bad token and a bad Matrix ID', async () => {
    await expect(connect().execute({ workspaceId: null, userId: '@helpdesk:example.org', password: 'nope' })).rejects.toThrow('Wrong Matrix user or password');
    await expect(connect().execute({ workspaceId: null, userId: '@helpdesk:example.org', accessToken: 'unknown' })).rejects.toThrow('did not accept that access token');
    await expect(connect().execute({ workspaceId: null, userId: 'helpdesk', password: 'secret' })).rejects.toBeInstanceOf(DomainValidationError);
    await expect(connect().execute({ workspaceId: null, userId: '@helpdesk:example.org' })).rejects.toThrow('password or an access token');
    expect(bots.bots).toEqual([]);
  });

  it('replaces the scope\'s bot and ends the old session', async () => {
    const first = await connect().execute({ workspaceId: 'ws-1', userId: '@helpdesk:example.org', password: 'secret' });
    const second = await connect().execute({ workspaceId: 'ws-1', userId: '@helpdesk:example.org', password: 'secret' });

    expect(second.getId()).toBe(first.getId());
    expect(bots.bots).toHaveLength(1);
    expect(client.loggedOut).toEqual(['token-1']);
  });

  describe('replaced by another account', () => {
    const room = (id: string, workspaceId: string, roomId: string) => new MatrixRoom({
      id, workspaceId, roomId, departmentId: null, events: [MatrixNoticeEvent.TICKET_CREATED],
      includeText: false, includeFiles: false, isActive: true, lastError: null, lastErrorAt: null,
    });

    beforeEach(async () => {
      client.passwords['@new:example.org'] = 'pw';
      await service().execute({ workspaceId: 'ws-1', userId: '@helpdesk:example.org', password: 'secret' });
      // !a: only the old bot is in; !b: the new one was invited already; !c: the old bot was removed
      client.inviteOnly = { '!a': ['@helpdesk:example.org'], '!b': ['@helpdesk:example.org', '@new:example.org'], '!c': [] };
      rooms.rooms = [room('r-a', 'ws-1', '!a'), room('r-b', 'ws-1', '!b'), room('r-c', 'ws-1', '!c'), room('r-other', 'ws-2', '!other')];
      rooms.workspacesWithOwnBot = ['ws-1'];
      // Ana's chat with the old bot, and one the old bot was taken out of
      const botId = (await bots.findByWorkspaceId('ws-1'))!.getId();
      client.inviteOnly['!dm-ana'] = ['@helpdesk:example.org', '@ana:example.org'];
      client.inviteOnly['!dm-gone'] = [];
      directRooms.rooms = [
        new MatrixDirectRoom({ id: 'd-ana', botId, userId: 'ana', matrixUserId: '@ana:example.org', roomId: '!dm-ana', lostAt: null }),
        new MatrixDirectRoom({ id: 'd-gone', botId, userId: 'eva', matrixUserId: '@eva:example.org', roomId: '!dm-gone', lostAt: null }),
      ];
    });

    it("hands over the users' direct chats too, and the old bot leaves them", async () => {
      await service().execute({ workspaceId: 'ws-1', userId: '@new:example.org', password: 'pw' });
      expect(client.inviteOnly['!dm-ana']).toContain('@new:example.org');
      expect(client.left).toEqual(expect.arrayContaining(['!dm-ana', '!dm-gone']));
      // The chat it could not get into is forgotten: the next notice opens a new one
      expect(directRooms.rooms.map((r) => r.roomId)).toEqual(['!dm-ana']);
    });

    it("brings the new bot into the old one's rooms before ending the old session, and says where it could not", async () => {
      const { handOver } = await service().execute({ workspaceId: 'ws-1', userId: '@new:example.org', password: 'pw' });
      expect(handOver).toEqual({ moved: 2, notMoved: [{ roomId: '!c', error: 'You are not in the room' }] });
      expect(client.inviteOnly['!a']).toContain('@new:example.org');
      // Not another workspace's room, and the old session ended only after the invitations
      expect(client.inviteOnly['!other']).toBeUndefined();
      expect(client.loggedOut).toEqual(['token-1']);
    });

    it('does nothing with the rooms when the same account connects again', async () => {
      const { handOver } = await service().execute({ workspaceId: 'ws-1', userId: '@helpdesk:example.org', password: 'secret' });
      expect(handOver).toBeNull();
      expect(client.inviteOnly['!a']).toEqual(['@helpdesk:example.org']);
    });

    it("for the installation's bot, hands over only the rooms of workspaces without a bot of their own", async () => {
      await service().execute({ workspaceId: null, userId: '@helpdesk:example.org', password: 'secret' });
      client.inviteOnly['!other'] = ['@helpdesk:example.org'];
      const { handOver } = await service().execute({ workspaceId: null, userId: '@new:example.org', password: 'pw' });
      expect(handOver).toEqual({ moved: 1, notMoved: [] });
      expect(client.inviteOnly['!other']).toContain('@new:example.org');
      expect(client.inviteOnly['!a']).toEqual(['@helpdesk:example.org']);
    });
  });

  it('parses Matrix IDs', () => {
    expect(matrixServerName('@bot:example.org')).toBe('example.org');
    expect(matrixServerName('@bot:example.org:8448')).toBe('example.org:8448');
    expect(matrixServerName('bot@example.org')).toBeNull();
  });
});

describe('Disconnecting and resolving a Matrix bot', () => {
  const cipher = new FakeSecretCipher();
  const bot = (id: string, workspaceId: string | null, token = 'enc:tok') =>
    new MatrixBot({ id, workspaceId, homeserverUrl: 'https://m.example.org', userId: `@${id}:example.org`, deviceId: null, encryptedAccessToken: token });

  it('ends the session on the server, then forgets the bot', async () => {
    const bots = new MockMatrixBotRepository();
    const client = new FakeMatrixClient();
    await bots.save(bot('own', 'ws-1'));

    const result = await new DisconnectMatrixBot(bots, client, cipher, new CloseMatrixDirectRooms(client, cipher, new MockMatrixDirectRoomRepository(), null)).execute({ workspaceId: 'ws-1' });
    expect(result.sessionEnded).toBe(true);
    expect(client.loggedOut).toEqual(['tok']);
    expect(bots.bots).toEqual([]);
  });

  it("leaves the users' direct chats before ending the session", async () => {
    const bots = new MockMatrixBotRepository();
    const directRooms = new MockMatrixDirectRoomRepository();
    const client = new FakeMatrixClient();
    await bots.save(bot('own', 'ws-1'));
    directRooms.rooms = [new MatrixDirectRoom({ id: 'd-1', botId: 'own', userId: 'ana', matrixUserId: '@ana:example.org', roomId: '!dm', lostAt: null })];

    await new DisconnectMatrixBot(bots, client, cipher, new CloseMatrixDirectRooms(client, cipher, directRooms, null)).execute({ workspaceId: 'ws-1' });
    expect(client.left).toEqual(['!dm']);
    expect(directRooms.rooms).toEqual([]);
  });

  it('forgets it even when the server cannot be reached, and says so', async () => {
    const bots = new MockMatrixBotRepository();
    const client = new FakeMatrixClient();
    client.logout = async () => { throw new Error('offline'); };
    await bots.save(bot('own', 'ws-1'));

    expect((await new DisconnectMatrixBot(bots, client, cipher, new CloseMatrixDirectRooms(client, cipher, new MockMatrixDirectRoomRepository(), null)).execute({ workspaceId: 'ws-1' })).sessionEnded).toBe(false);
    expect(bots.bots).toEqual([]);
  });

  it('gives a workspace its own bot, else the installation\'s', async () => {
    const bots = new MockMatrixBotRepository();
    await bots.save(bot('installation', null));
    await bots.save(bot('own', 'ws-1'));
    const resolve = new ResolveMatrixBot(bots);

    expect((await resolve.execute('ws-1'))?.userId).toBe('@own:example.org');
    expect((await resolve.execute('ws-2'))?.userId).toBe('@installation:example.org');
  });
});
