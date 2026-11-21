import { MatrixBot } from '../../../src/matrix/domain/entities/matrix-bot';
import { MatrixIdentity } from '../../../src/matrix/domain/entities/matrix-identity';
import { MatrixNoticeThrottle } from '../../../src/matrix/domain/matrix-notice-throttle';
import { NotifyMatrixStandalone } from '../../../src/matrix/domain/services/matrix-standalone-notify';
import { OpenMatrixDirectRoom } from '../../../src/matrix/domain/services/matrix-direct-room-open';
import { MatrixStandaloneNoticeEvent } from '../../../src/notification/domain/matrix-personal-notice';
import { User } from '../../../src/user/domain/entities/user';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockAuditLogRepository } from '../../mocks/mock-audit-log.repository';
import { MockUserRepository } from '../../mocks/mock-user.repository';
import {
  FakeMatrixClient,
  FakeSecretCipher,
  MockMatrixBotRepository,
  MockMatrixDirectRoomRepository,
  MockMatrixIdentityRepository,
} from '../../mocks/mock-matrix';

const user = (id: string, language = 'en') => new User({
  id, email: `${id}@acme.test`, password: 'hashed', firstName: id, lastName: 'Test',
  isActive: true, isSystemAdmin: false, isEmailVerified: true, language, theme: 'system',
});

const identity = (userId: string, overrides: Partial<ConstructorParameters<typeof MatrixIdentity>[0]> = {}) => new MatrixIdentity({
  id: `id-${userId}`, userId, matrixUserId: `@${userId}:example.org`, verifiedAt: new Date('2026-11-01'),
  codeHash: null, codeExpiresAt: null, codeAttempts: 0, codeSentAt: null, codeSends: 0, sendWindowStartedAt: null, ...overrides,
});

// The installation's bot, and Globex (ws-2) with its own. Ana (English) and Eva (Spanish) have a
// verified account; Pau's code is still pending.
describe('Sending notices that are not about a ticket to the users\' Matrix chats', () => {
  let client: FakeMatrixClient;
  let bots: MockMatrixBotRepository;
  let directRooms: MockMatrixDirectRoomRepository;
  let notify: NotifyMatrixStandalone;

  const event = (overrides: Partial<MatrixStandaloneNoticeEvent> = {}): MatrixStandaloneNoticeEvent => ({
    kind: 'member-joined',
    userIds: ['ana'],
    workspaceId: null,
    icon: '👋',
    headline: { en: 'Leo (agent) joined the Acme team', es: 'Leo (agente) se unió al equipo de Acme' },
    action: { en: 'See the team', es: 'Ver el equipo' },
    path: '/dashboard/workspaces/acme/members',
    ...overrides,
  });
  const bodies = () => client.sent.map((s) => String(s.content.body));

  beforeEach(async () => {
    client = new FakeMatrixClient();
    bots = new MockMatrixBotRepository();
    directRooms = new MockMatrixDirectRoomRepository();
    const identities = new MockMatrixIdentityRepository();
    const users = new MockUserRepository();
    const cipher = new FakeSecretCipher();

    await bots.save(new MatrixBot({ id: 'bot', workspaceId: null, homeserverUrl: 'https://m.example.org', userId: '@helpdesk:example.org', deviceId: null, encryptedAccessToken: 'enc:tok' }));
    await bots.save(new MatrixBot({ id: 'globex-bot', workspaceId: 'ws-2', homeserverUrl: 'https://m.globex.test', userId: '@bot:globex.test', deviceId: null, encryptedAccessToken: 'enc:globex' }));
    for (const [id, lang] of [['ana', 'en'], ['eva', 'es'], ['pau', 'en']]) users.seed(user(id, lang));
    await identities.save(identity('ana'));
    await identities.save(identity('eva'));
    await identities.save(identity('pau', { verifiedAt: null, codeHash: 'abc' }));

    notify = new NotifyMatrixStandalone(
      new FakeIdGenerator(), client, cipher, bots, identities, directRooms, users, new MockAuditLogRepository(),
      new OpenMatrixDirectRoom(new FakeIdGenerator(), client, cipher, directRooms),
      async (workspaceId) => (workspaceId ? 'https://help.globex.test' : 'https://helpdesk.example.org'),
      new MatrixNoticeThrottle(), async () => undefined,
    );
  });

  it('writes on its own, outside any thread, in each user\'s language, with the link', async () => {
    expect((await notify.execute(event({ userIds: ['ana', 'eva'] }))).sent).toBe(2);

    expect(bodies()).toEqual([
      '👋 Leo (agent) joined the Acme team\nhttps://helpdesk.example.org/dashboard/workspaces/acme/members',
      '👋 Leo (agente) se unió al equipo de Acme\nhttps://helpdesk.example.org/dashboard/workspaces/acme/members',
    ]);
    expect(client.sent[0].content['m.relates_to']).toBeUndefined();
    expect(String(client.sent[1].content.formatted_body)).toContain('>Ver el equipo</a>');
  });

  it('uses the installation\'s bot for what is about no workspace, and the workspace\'s own when it has one', async () => {
    await notify.execute(event());
    await notify.execute(event({ workspaceId: 'ws-2' }));
    expect(client.sent.map((s) => s.homeserverUrl)).toEqual(['https://m.example.org', 'https://m.globex.test']);
    expect(bodies()[1]).toContain('https://help.globex.test/');
  });

  it('only reaches verified accounts', async () => {
    expect((await notify.execute(event({ userIds: ['pau'] }))).sent).toBe(0);
    expect(client.sent).toEqual([]);
  });

  it('pauses the bot\'s notices to someone who left its chat', async () => {
    await notify.execute(event());
    client.memberships['!direct-1:example.org'] = { '@ana:example.org': 'leave' };

    expect((await notify.execute(event())).sent).toBe(0);
    expect((await directRooms.find('bot', 'ana'))?.lostAt).toBeInstanceOf(Date);
  });

  it('sends nothing without a bot', async () => {
    await bots.delete('bot');
    expect((await notify.execute(event())).sent).toBe(0);
  });
});
