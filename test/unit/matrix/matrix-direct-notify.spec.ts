import { MatrixBot } from '../../../src/matrix/domain/entities/matrix-bot';
import { MatrixIdentity } from '../../../src/matrix/domain/entities/matrix-identity';
import { MatrixApiError } from '../../../src/matrix/domain/matrix-client';
import { MatrixNoticeThrottle } from '../../../src/matrix/domain/matrix-notice-throttle';
import { NotifyMatrixDirect } from '../../../src/matrix/domain/services/matrix-direct-notify';
import { OpenMatrixDirectRoom } from '../../../src/matrix/domain/services/matrix-direct-room-open';
import { SendMatrixDirectSkipped } from '../../../src/matrix/domain/services/matrix-direct-skipped-send';
import { MatrixPersonalNoticeEvent } from '../../../src/notification/domain/matrix-personal-notice';
import { Ticket } from '../../../src/ticket/domain/entities/ticket';
import { TicketPriority } from '../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../src/ticket/domain/enums/ticket-status.enum';
import { User } from '../../../src/user/domain/entities/user';
import { Workspace } from '../../../src/workspace/domain/entities/workspace';
import { WorkspaceMember } from '../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockAuditLogRepository } from '../../mocks/mock-audit-log.repository';
import { MockTicketRepository } from '../../mocks/mock-ticket.repository';
import { MockUserRepository } from '../../mocks/mock-user.repository';
import { MockWorkspaceRepository } from '../../mocks/mock-workspace.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';
import {
  FakeMatrixClient,
  FakeSecretCipher,
  MockMatrixBotRepository,
  MockMatrixDirectRoomRepository,
  MockMatrixIdentityRepository,
  MockMatrixTicketThreadRepository,
} from '../../mocks/mock-matrix';

const user = (id: string, language = 'en') => new User({
  id, email: `${id}@acme.test`, password: 'hashed', firstName: id, lastName: 'Test',
  isActive: true, isSystemAdmin: false, isEmailVerified: true, language, theme: 'system',
});

const identity = (userId: string, overrides: Partial<ConstructorParameters<typeof MatrixIdentity>[0]> = {}) => new MatrixIdentity({
  id: `id-${userId}`, userId, matrixUserId: `@${userId}:example.org`, verifiedAt: new Date('2026-11-01'),
  codeHash: null, codeExpiresAt: null, codeAttempts: 0, codeSentAt: null, codeSends: 0, sendWindowStartedAt: null, ...overrides,
});

// Acme (ws-1) writes with the installation's bot. Ana (English) and Eva (Spanish) are agents with a
// verified account; Bob is a customer with one; Pau is an agent whose code is still pending.
describe('Sending personal notices to the users\' Matrix chats', () => {
  let client: FakeMatrixClient;
  let bots: MockMatrixBotRepository;
  let identities: MockMatrixIdentityRepository;
  let directRooms: MockMatrixDirectRoomRepository;
  let threads: MockMatrixTicketThreadRepository;
  let audit: MockAuditLogRepository;
  let throttle: MatrixNoticeThrottle;
  let notify: NotifyMatrixDirect;

  const event = (overrides: Partial<MatrixPersonalNoticeEvent> = {}): MatrixPersonalNoticeEvent => ({
    kind: 'assigned', userIds: ['ana'], ticketId: 'ticket-1', workspaceSlug: 'acme', ...overrides,
  });
  const bodies = () => client.sent.map((s) => String(s.content.body));

  beforeEach(async () => {
    client = new FakeMatrixClient();
    bots = new MockMatrixBotRepository();
    identities = new MockMatrixIdentityRepository();
    directRooms = new MockMatrixDirectRoomRepository();
    threads = new MockMatrixTicketThreadRepository();
    audit = new MockAuditLogRepository();
    throttle = new MatrixNoticeThrottle();
    const tickets = new MockTicketRepository();
    const users = new MockUserRepository();
    const workspaces = new MockWorkspaceRepository();
    const members = new MockWorkspaceMemberRepository();

    await bots.save(new MatrixBot({ id: 'bot', workspaceId: null, homeserverUrl: 'https://m.example.org', userId: '@helpdesk:example.org', deviceId: null, encryptedAccessToken: 'enc:tok' }));
    await workspaces.create(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    await tickets.create(new Ticket({
      id: 'ticket-1', name: 'Printer on fire', description: '<p>secret</p>', priority: TicketPriority.HIGH, status: TicketStatus.PENDING,
      categoryId: 'cat', workspaceId: 'ws-1', reporterId: 'bob', assigneeId: 'ana', ticketNumber: 7, tagIds: [], customFields: {},
      discardReason: null, resolvedAt: null, resolvedById: null, createdAt: new Date(), deletedAt: null,
    }));
    for (const [id, lang] of [['ana', 'en'], ['eva', 'es'], ['bob', 'en'], ['pau', 'en']]) users.seed(user(id, lang));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'ana', role: WorkspaceRole.AGENT }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'eva', role: WorkspaceRole.SUPERVISOR }));
    members.seed(new WorkspaceMember({ id: 'm-3', workspaceId: 'ws-1', userId: 'bob', role: WorkspaceRole.USER }));
    members.seed(new WorkspaceMember({ id: 'm-4', workspaceId: 'ws-1', userId: 'pau', role: WorkspaceRole.AGENT }));
    await identities.save(identity('ana'));
    await identities.save(identity('eva'));
    await identities.save(identity('bob'));
    await identities.save(identity('pau', { verifiedAt: null, codeHash: 'abc' }));

    const cipher = new FakeSecretCipher();
    // Globex (ws-2) has its own bot; Ana is on its team too
    await bots.save(new MatrixBot({ id: 'globex-bot', workspaceId: 'ws-2', homeserverUrl: 'https://m.globex.test', userId: '@bot:globex.test', deviceId: null, encryptedAccessToken: 'enc:globex' }));
    await workspaces.create(new Workspace({ id: 'ws-2', name: 'Globex', slug: 'globex', description: '' }));
    await tickets.create(new Ticket({
      id: 'ticket-2', name: 'VPN down', description: '', priority: TicketPriority.LOW, status: TicketStatus.OPEN,
      categoryId: 'cat', workspaceId: 'ws-2', reporterId: 'bob', assigneeId: null, ticketNumber: 3, tagIds: [], customFields: {},
      discardReason: null, resolvedAt: null, resolvedById: null, createdAt: new Date(), deletedAt: null,
    }));
    members.seed(new WorkspaceMember({ id: 'm-5', workspaceId: 'ws-2', userId: 'ana', role: WorkspaceRole.AGENT }));
    usersRepo = users;

    notify = new NotifyMatrixDirect(
      new FakeIdGenerator(), client, cipher, bots, identities, directRooms, threads, tickets, users, workspaces, members, audit,
      new OpenMatrixDirectRoom(new FakeIdGenerator(), client, cipher, directRooms),
      async () => 'https://help.acme.test', throttle, async () => undefined,
    );
  });

  let usersRepo: MockUserRepository;

  it('opens the user\'s chat the first time and tells them, naming the workspace, without the ticket\'s text', async () => {
    expect((await notify.execute(event())).sent).toBe(1);

    expect(client.directRooms).toEqual([{ roomId: '!direct-1:example.org', userId: '@ana:example.org', name: 'Open Helpdesk notices' }]);
    expect(bodies()).toEqual(['👤 You were assigned TK-000007 · Printer on fire\nWorkspace: Acme\nhttps://help.acme.test/dashboard/workspaces/acme/tickets/ticket-1']);
    expect(bodies()[0]).not.toContain('secret');
    // The link names the ticket, for screen readers going through the links
    expect(String(client.sent[0].content.formatted_body)).toContain('>Open TK-000007</a>');
  });

  it('writes in each user\'s language', async () => {
    await notify.execute(event({ kind: 'status-changed', oldStatus: 'open', newStatus: 'pending', userIds: ['ana', 'eva'] }));
    expect(bodies().map((b) => b.split('\n')[0])).toEqual([
      '🔄 TK-000007: open → pending · Printer on fire',
      '🔄 TK-000007: abierto → pendiente · Printer on fire',
    ]);
  });

  it('only reaches active team members with a verified account', async () => {
    expect((await notify.execute(event({ userIds: ['ana', 'bob', 'pau', 'nobody'] }))).sent).toBe(1);
    expect(client.directRooms.map((r) => r.userId)).toEqual(['@ana:example.org']);

    (await usersRepo.findById('ana'))!.isActive = false;
    expect((await notify.execute(event())).sent).toBe(0);
  });

  it('keeps one chat and threads a ticket\'s notices under its first one', async () => {
    await notify.execute(event());
    await notify.execute(event({ kind: 'comment', actorName: 'Bob Test' }));

    expect(client.directRooms).toHaveLength(1);
    expect(client.sent[1].content['m.relates_to']).toMatchObject({ rel_type: 'm.thread', event_id: '$event-1' });
    expect(bodies()[1]).toMatch(/^💬 Bob Test wrote on TK-000007/);
  });

  it('pauses only that bot\'s notices when the user left or rejected its chat', async () => {
    await notify.execute(event());
    await notify.execute(event({ ticketId: 'ticket-2', workspaceSlug: 'globex' }));
    client.memberships['!direct-1:example.org'] = { '@ana:example.org': 'leave' };

    expect((await notify.execute(event())).sent).toBe(0);
    const paused = await directRooms.find('bot', 'ana');
    expect(paused?.lostAt).toBeInstanceOf(Date);
    expect(client.left).toEqual(['!direct-1:example.org']);
    expect(audit.entries.map((e) => [e.action, e.metadata])).toEqual([
      ['matrix-account-lost', { matrixUserId: '@ana:example.org', bot: '@helpdesk:example.org', membership: 'leave' }],
    ]);

    // Paused: no new chat, nothing sent, the account stays verified
    expect((await notify.execute(event())).sent).toBe(0);
    expect(client.directRooms).toHaveLength(2);
    expect((await identities.findByUserId('ana'))?.verifiedAt).toBeInstanceOf(Date);
    // Globex's bot goes on
    expect((await notify.execute(event({ ticketId: 'ticket-2', workspaceSlug: 'globex' }))).sent).toBe(1);
  });

  it('opens a new chat when the bot is no longer in the old one', async () => {
    await notify.execute(event());
    client.membershipFailures['!direct-1:example.org'] = new MatrixApiError(403, 'M_FORBIDDEN', 'User @helpdesk:example.org not in room');

    expect((await notify.execute(event())).sent).toBe(1);
    expect(client.directRooms.map((r) => r.roomId)).toEqual(['!direct-1:example.org', '!direct-2:example.org']);
    expect(client.sent[1].roomId).toBe('!direct-2:example.org');
    expect(audit.entries).toEqual([]);
  });

  it('pauses nobody when the server refuses for another reason, and tells the others', async () => {
    client.sendFailures.push(new MatrixApiError(403, 'M_CONSENT_NOT_GIVEN', 'Accept the terms first'));

    const result = await notify.execute(event({ userIds: ['ana', 'eva'] }));
    expect(result.sent).toBe(1);
    expect(result.failures).toEqual([{ userId: 'ana', error: 'Accept the terms first' }]);
    expect(directRooms.rooms.every((r) => r.lostAt === null)).toBe(true);
    expect(audit.entries).toEqual([]);
  });

  it('keeps the chat when the server fails for a while', async () => {
    client.sendFailures.push(...[1, 2, 3].map(() => new MatrixApiError(502, null, 'Bad gateway')));
    expect((await notify.execute(event())).sent).toBe(0);
    expect((await directRooms.find('bot', 'ana'))?.lostAt).toBeNull();
  });

  it('sends nothing for a ticket of another workspace, a deleted ticket, or without a bot', async () => {
    expect((await notify.execute(event({ workspaceSlug: 'globex' }))).sent).toBe(0);
    await bots.delete('bot');
    expect((await notify.execute(event())).sent).toBe(0);
    expect(client.sent).toEqual([]);
  });

  it('caps the notices a user gets per minute and bot, and sums up the rest in that chat', async () => {
    for (let i = 0; i < 25; i++) await notify.execute(event());
    expect(client.sent).toHaveLength(20);
    // Another bot's chat has its own count
    expect((await notify.execute(event({ ticketId: 'ticket-2', workspaceSlug: 'globex' }))).sent).toBe(1);

    // Summed up once the minute is over
    expect(throttle.drain()).toEqual([]);

    // The summary goes to the chat the key names, in the user's language
    const skipped = new SendMatrixDirectSkipped(client, new FakeSecretCipher(), bots, directRooms, usersRepo);
    await skipped.execute({ botId: 'bot', userId: 'eva', count: 3 });
    expect(client.sent).toHaveLength(21);
    await skipped.execute({ botId: 'bot', userId: 'ana', count: 5 });
    expect(bodies()[21]).toBe('ℹ️ 5 more notices were not sent here in the last minute, so as not to flood the chat: you can see them in Open Helpdesk.');
  });
});
