import { MatrixBot } from '../../../src/matrix/domain/entities/matrix-bot';
import { MatrixRoom } from '../../../src/matrix/domain/entities/matrix-room';
import { MatrixNoticeEvent } from '../../../src/matrix/domain/enums/matrix-notice-event.enum';
import { MatrixApiError } from '../../../src/matrix/domain/matrix-client';
import { SaveMatrixRoom } from '../../../src/matrix/domain/services/matrix-room-save';
import { CheckMatrixRoom } from '../../../src/matrix/domain/services/matrix-room-check';
import { InspectMatrixRoom } from '../../../src/matrix/domain/services/matrix-room-inspect';
import { LeaveCheckedMatrixRoom } from '../../../src/matrix/domain/services/matrix-room-checked-leave';
import { DeliverMatrixNotice } from '../../../src/matrix/domain/services/matrix-notice-deliver';
import { SendMatrixPlainNotice } from '../../../src/matrix/domain/services/matrix-plain-notice-send';
import { AuditAction } from '../../../src/audit-log/domain/enums/audit-action.enum';
import { Workspace } from '../../../src/workspace/domain/entities/workspace';
import { ConflictError, DomainValidationError, EntityNotFoundError, TooManyRequestsError } from '../../../src/shared/domain/errors';
import { MatrixRoomScope } from '../../../src/matrix/domain/enums/matrix-room-scope.enum';
import { FindMatrixRoomScope } from '../../../src/matrix/domain/services/matrix-room-scope-find';
import { PauseMatrixRoom } from '../../../src/matrix/domain/services/matrix-room-pause';
import { RemoveMatrixRoom } from '../../../src/matrix/domain/services/matrix-room-remove';
import { LeaveMatrixRoom } from '../../../src/matrix/domain/services/matrix-room-leave';
import { Department } from '../../../src/department/domain/entities/department';
import { Project } from '../../../src/project/domain/entities/project';
import { Organization } from '../../../src/organization/domain/entities/organization';
import { MockDepartmentRepository } from '../../mocks/mock-department.repository';
import { MockProjectRepository } from '../../mocks/mock-project.repository';
import { MockOrganizationRepository } from '../../mocks/mock-organization.repository';
import { GetMatrixSettingsQuery } from '../../../src/matrix/application/queries/get-matrix-settings.query';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockAuditLogRepository } from '../../mocks/mock-audit-log.repository';
import { MockWorkspaceRepository } from '../../mocks/mock-workspace.repository';
import { FakeMatrixClient, FakeSecretCipher, MockMatrixBotRepository, MockMatrixRoomCreationRepository, MockMatrixRoomRepository, MockMatrixTicketThreadRepository } from '../../mocks/mock-matrix';
import { MATRIX_ROOMS_PER_DAY, ReserveMatrixRoomCreation } from '../../../src/matrix/domain/services/matrix-room-creation-reserve';

const cipher = new FakeSecretCipher();
const installationBot = () =>
  new MatrixBot({ id: 'bot-1', workspaceId: null, homeserverUrl: 'https://m.example.org', userId: '@helpdesk:example.org', deviceId: 'D', encryptedAccessToken: 'enc:tok' });
const room = (overrides: Partial<ConstructorParameters<typeof MatrixRoom>[0]> = {}) => new MatrixRoom({
  id: 'room-1', workspaceId: 'ws-1', roomId: '!abc', departmentId: null, events: [MatrixNoticeEvent.TICKET_CREATED],
  includeText: false, includeFiles: false, isActive: true, lastError: null, lastErrorAt: null, ...overrides,
});

describe('Setting a workspace\'s Matrix room', () => {
  let rooms: MockMatrixRoomRepository;
  let bots: MockMatrixBotRepository;
  let client: FakeMatrixClient;
  let departments: MockDepartmentRepository;
  let projects: MockProjectRepository;
  let organizations: MockOrganizationRepository;
  let ids: FakeIdGenerator;
  let creations: MockMatrixRoomCreationRepository;
  let now: Date;
  const service = () => new SaveMatrixRoom(ids, rooms, bots, client, cipher, new FindMatrixRoomScope(departments, projects, organizations), new ReserveMatrixRoomCreation(ids, creations, () => now));
  const save = () => ({ execute: async (p: Parameters<SaveMatrixRoom['execute']>[0]) => (await service().execute(p)).room });
  const whole = { scope: MatrixRoomScope.WORKSPACE, scopeId: null };
  const props = { workspaceId: 'ws-1', room: '#support:example.org', scope: whole, events: [MatrixNoticeEvent.TICKET_CREATED], includeText: false, includeFiles: false, onlyTicketsWithoutOtherRoom: false, actorIsSystemAdmin: false };

  beforeEach(async () => {
    ids = new FakeIdGenerator('room');
    creations = new MockMatrixRoomCreationRepository();
    now = new Date('2026-11-15T10:00:00Z');
    rooms = new MockMatrixRoomRepository();
    bots = new MockMatrixBotRepository();
    client = new FakeMatrixClient();
    client.tokens.tok = '@helpdesk:example.org';
    client.joinable['#support:example.org'] = '!abc';
    client.joinable['#acme:example.org'] = '!acme';
    client.joinable['#web:example.org'] = '!web';
    await bots.save(installationBot());
    departments = new MockDepartmentRepository();
    projects = new MockProjectRepository();
    organizations = new MockOrganizationRepository();
    await departments.create(new Department({ id: 'dep-it', name: 'IT', description: null, workspaceId: 'ws-1' }));
    await projects.create(new Project({ id: 'prj-web', name: 'Web', description: null, workspaceId: 'ws-1' }));
    await projects.create(new Project({ id: 'prj-other', name: 'Theirs', description: null, workspaceId: 'ws-2' }));
    await organizations.create(new Organization({ id: 'org-acme', name: 'Acme Ltd', description: null, notes: null, logo: null, domains: [], workspaceId: 'ws-1' }));
  });

  it('joins the room (accepting the invitation) and keeps its ID, not the alias', async () => {
    const saved = await save().execute(props);
    expect(saved.roomId).toBe('!abc');
    expect(saved.departmentId).toBeNull();
    expect(saved.isActive).toBe(true);
    expect(rooms.rooms).toHaveLength(1);
  });

  it('adds a room for one department, project or organization of the workspace', async () => {
    const forOrg = await save().execute({ ...props, room: '#acme:example.org', scope: { scope: MatrixRoomScope.ORGANIZATION, scopeId: 'org-acme' } });
    expect(forOrg).toMatchObject({ organizationId: 'org-acme', projectId: null, departmentId: null });
    const forProject = await save().execute({ ...props, room: '#web:example.org', scope: { scope: MatrixRoomScope.PROJECT, scopeId: 'prj-web' } });
    expect(forProject).toMatchObject({ projectId: 'prj-web', organizationId: null, departmentId: null });
    const forDepartment = await save().execute({ ...props, scope: { scope: MatrixRoomScope.DEPARTMENT, scopeId: 'dep-it' } });
    expect(forDepartment).toMatchObject({ departmentId: 'dep-it', projectId: null, organizationId: null });
    expect(rooms.rooms).toHaveLength(3);
  });

  it('refuses a department, project or organization that is not the workspace\'s, or was deleted', async () => {
    await expect(save().execute({ ...props, scope: { scope: MatrixRoomScope.PROJECT, scopeId: 'prj-other' } })).rejects.toBeInstanceOf(DomainValidationError);
    await projects.softDelete('prj-web');
    await expect(save().execute({ ...props, scope: { scope: MatrixRoomScope.PROJECT, scopeId: 'prj-web' } })).rejects.toBeInstanceOf(DomainValidationError);
    await expect(save().execute({ ...props, scope: { scope: MatrixRoomScope.ORGANIZATION, scopeId: null } })).rejects.toBeInstanceOf(DomainValidationError);
    expect(rooms.rooms).toEqual([]);
  });

  it('keeps one room per scope, and a Matrix room only once in a workspace', async () => {
    await save().execute(props);
    await expect(save().execute({ ...props, room: '#acme:example.org' })).rejects.toThrow('The whole workspace already has a room');
    const forOrg = { ...props, room: '#acme:example.org', scope: { scope: MatrixRoomScope.ORGANIZATION, scopeId: 'org-acme' } };
    await save().execute(forOrg);
    await expect(save().execute({ ...forOrg, room: '#web:example.org' })).rejects.toThrow('That organization already has a room');
    // The same Matrix room for a project would tell its tickets twice there
    await expect(save().execute({ ...props, scope: { scope: MatrixRoomScope.PROJECT, scopeId: 'prj-web' } })).rejects.toThrow('This workspace already sends notices to that room');
    expect(rooms.rooms).toHaveLength(2);
  });

  it("refuses another workspace's room before the bot joins it, unless a system admin shares it", async () => {
    await rooms.save(room({ id: 'theirs', workspaceId: 'ws-2', roomId: '!abc' }));
    await expect(save().execute(props)).rejects.toThrow('Another workspace already sends its notices to that room');
    expect(client.joined).toEqual([]);
    expect(rooms.rooms).toHaveLength(1);
    const shared = await save().execute({ ...props, actorIsSystemAdmin: true });
    expect(shared).toMatchObject({ workspaceId: 'ws-1', roomId: '!abc' });
    expect(client.joined).toEqual(['!abc']);
    expect(rooms.rooms).toHaveLength(2);
  });

  it('lets a workspace admin edit a room a system admin shared with another workspace', async () => {
    await rooms.save(room({ id: 'theirs', workspaceId: 'ws-2', roomId: '!abc' }));
    await rooms.save(room({ id: 'ours', workspaceId: 'ws-1', roomId: '!abc' }));
    const edited = await save().execute({ ...props, id: 'ours', includeText: true });
    expect(edited).toMatchObject({ roomId: '!abc', includeText: true });
  });

  it('edits a room by its ID, also its scope, and not another workspace\'s', async () => {
    const added = await save().execute(props);
    const edited = await save().execute({ ...props, id: added.getId(), scope: { scope: MatrixRoomScope.PROJECT, scopeId: 'prj-web' } });
    expect(edited.getId()).toBe(added.getId());
    expect(edited).toMatchObject({ roomId: '!abc', projectId: 'prj-web' });
    expect(rooms.rooms).toHaveLength(1);

    await rooms.save(room({ id: 'room-ws2', workspaceId: 'ws-2', roomId: '!theirs' }));
    await expect(save().execute({ ...props, id: 'room-ws2' })).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  it('leaves out the tickets another room tells of only in the room of the whole workspace', async () => {
    const general = await save().execute({ ...props, onlyTicketsWithoutOtherRoom: true });
    expect(general.onlyTicketsWithoutOtherRoom).toBe(true);
    const forOrg = await save().execute({ ...props, room: '#acme:example.org', scope: { scope: MatrixRoomScope.ORGANIZATION, scopeId: 'org-acme' }, onlyTicketsWithoutOtherRoom: true });
    expect(forOrg.onlyTicketsWithoutOtherRoom).toBe(false);
  });

  it('asks to invite the bot when it may not join', async () => {
    await expect(save().execute({ ...props, room: '!other' })).rejects.toThrow('Invite @helpdesk:example.org to the room first');
    expect(rooms.rooms).toEqual([]);
  });

  it('needs a bot, and one whose token can still be read', async () => {
    bots.bots = [];
    await expect(save().execute(props)).rejects.toThrow('Connect a Matrix bot first');
    await bots.save(new MatrixBot({ ...installationBot(), id: 'bot-1', encryptedAccessToken: 'garbled' } as any));
    await expect(save().execute(props)).rejects.toThrow('Connect the Matrix bot again');
  });

  it('saving a room again updates it and resumes it', async () => {
    await rooms.save(room({ isActive: false, lastError: 'Forbidden' }));
    const saved = await save().execute({ ...props, id: 'room-1', events: [MatrixNoticeEvent.SLA_BREACHED, MatrixNoticeEvent.SLA_BREACHED], includeText: true });
    expect(saved.getId()).toBe('room-1');
    expect(saved.events).toEqual([MatrixNoticeEvent.SLA_BREACHED]);
    expect(saved.includeText).toBe(true);
    expect(saved.isActive).toBe(true);
    expect(saved.lastError).toBeNull();
  });

  it('does not let a workspace post into a room another workspace uses, unless a system admin sets it', async () => {
    await rooms.save(room({ id: 'room-other', workspaceId: 'ws-2' }));
    await expect(save().execute(props)).rejects.toBeInstanceOf(ConflictError);
    await expect(save().execute({ ...props, actorIsSystemAdmin: true })).resolves.toBeDefined();
  });

  describe('a room the bot creates', () => {
    const newRoom = (invite: string[] = ['@luis:example.org', '@stephen:other.org']) => ({ create: { name: '  Open Helpdesk · Acme Ltd ', invite } });
    const forOrg = { ...props, scope: { scope: MatrixRoomScope.ORGANIZATION, scopeId: 'org-acme' } };

    it('creates it, invites the people given, makes them admins and keeps the bot\'s own power', async () => {
      const { room: saved, created } = await service().execute({ ...forOrg, room: newRoom(['@luis:example.org', '@luis:example.org', ' @stephen:other.org', '@helpdesk:example.org']) });
      expect(saved).toMatchObject({ roomId: '!created-1:example.org', organizationId: 'org-acme', isActive: true });
      expect(created).toEqual({ roomId: '!created-1:example.org', notInvited: [], adminsSet: true });
      expect(client.created).toEqual([{
        roomId: '!created-1:example.org',
        name: 'Open Helpdesk · Acme Ltd',
        // Each once, and not the bot itself
        invited: ['@luis:example.org', '@stephen:other.org'],
        powerLevels: { users: { '@helpdesk:example.org': 100, '@luis:example.org': 100, '@stephen:other.org': 100 }, users_default: 0, events_default: 0 },
      }]);
    });

    it('keeps the room when someone cannot be invited, and says who; they do not become admins', async () => {
      client.inviteFailures['@stephen:other.org'] = new MatrixApiError(404, 'M_NOT_FOUND', 'Unknown user');
      const { created } = await service().execute({ ...forOrg, room: newRoom() });
      expect(created?.notInvited).toEqual([{ userId: '@stephen:other.org', error: 'Unknown user' }]);
      expect(client.created[0].powerLevels.users).toEqual({ '@helpdesk:example.org': 100, '@luis:example.org': 100 });
      expect(rooms.rooms).toHaveLength(1);
    });

    it('still saves the room when the admins cannot be set, and says so', async () => {
      client.powerLevelsFailure = new MatrixApiError(403, 'M_FORBIDDEN', 'Forbidden');
      const { created } = await service().execute({ ...forOrg, room: newRoom() });
      expect(created?.adminsSet).toBe(false);
      expect(rooms.rooms).toHaveLength(1);
    });

    it('creates nothing when the setting is refused, a name is missing or an invitee is not a Matrix ID', async () => {
      await save().execute(forOrg);
      await expect(service().execute({ ...forOrg, room: newRoom() })).rejects.toThrow('That organization already has a room');
      await expect(service().execute({ ...props, room: { create: { name: '  ', invite: [] } } })).rejects.toThrow('Give the new room a name');
      await expect(service().execute({ ...props, room: newRoom(['luis@example.org']) })).rejects.toThrow('"luis@example.org" is not a Matrix ID');
      expect(client.created).toEqual([]);
    });

    it('explains a server that does not let the bot create rooms', async () => {
      client.createFailure = new MatrixApiError(403, 'M_FORBIDDEN', 'You are not permitted to create rooms');
      await expect(service().execute({ ...forOrg, room: newRoom() })).rejects.toThrow('The Matrix server does not let the bot create rooms');
      client.createFailure = new MatrixApiError(429, 'M_LIMIT_EXCEEDED', 'Too many requests');
      await expect(service().execute({ ...forOrg, room: newRoom() })).rejects.toThrow('try again in a minute');
      expect(rooms.rooms).toEqual([]);
      // A room that was not created does not count against the day's limit
      expect(creations.creations).toEqual([]);
    });

    it(`creates at most ${MATRIX_ROOMS_PER_DAY} rooms a day for a workspace, and more the next day`, async () => {
      const scopes = [...Array(MATRIX_ROOMS_PER_DAY + 1).keys()].map((i) => `org-${i}`);
      for (const id of scopes) await organizations.create(new Organization({ id, name: id, description: null, notes: null, logo: null, domains: [], workspaceId: 'ws-1' }));
      const forScope = (id: string) => ({ ...props, scope: { scope: MatrixRoomScope.ORGANIZATION, scopeId: id }, room: newRoom() });

      for (const id of scopes.slice(0, MATRIX_ROOMS_PER_DAY)) await service().execute(forScope(id));
      const refused = service().execute(forScope(scopes[MATRIX_ROOMS_PER_DAY]));
      await expect(refused).rejects.toBeInstanceOf(TooManyRequestsError);
      await expect(service().execute(forScope(scopes[MATRIX_ROOMS_PER_DAY]))).rejects.toMatchObject({ code: 'matrix-too-many-rooms' });
      expect(client.created).toHaveLength(MATRIX_ROOMS_PER_DAY);
      // Another workspace has its own limit, and a room the bot only joins does not count
      await expect(save().execute(props)).resolves.toBeDefined();

      now = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 60_000);
      await expect(service().execute(forScope(scopes[MATRIX_ROOMS_PER_DAY]))).resolves.toBeDefined();
      // The old ones are forgotten
      expect(creations.creations).toHaveLength(1);
    });

    it('lets only one of two requests take the last free place of the day', async () => {
      for (let i = 0; i < MATRIX_ROOMS_PER_DAY - 1; i++) await new ReserveMatrixRoomCreation(ids, creations, () => now).execute('ws-1');
      const reserve = new ReserveMatrixRoomCreation(ids, creations, () => now);
      const results = await Promise.allSettled([reserve.execute('ws-1'), reserve.execute('ws-1')]);
      expect(results.filter((r) => r.status === 'fulfilled').length).toBeLessThanOrEqual(1);
      expect(await creations.countSince('ws-1', new Date(0))).toBeLessThanOrEqual(MATRIX_ROOMS_PER_DAY);
      await expect(reserve.execute('ws-2')).resolves.toBeDefined();
    });
  });
});

describe('Checking a Matrix room', () => {
  let bots: MockMatrixBotRepository;
  let rooms: MockMatrixRoomRepository;
  let client: FakeMatrixClient;
  const check = (room: string, actorIsSystemAdmin = false) => new CheckMatrixRoom(bots, rooms, client, cipher).execute({ workspaceId: 'ws-1', room, actorIsSystemAdmin });

  beforeEach(async () => {
    bots = new MockMatrixBotRepository();
    rooms = new MockMatrixRoomRepository();
    client = new FakeMatrixClient();
    client.tokens.tok = '@helpdesk:example.org';
    client.joinable['#support:example.org'] = '!abc';
    await bots.save(installationBot());
  });

  it('tells the room\'s ID, name, address and members once the bot is in it', async () => {
    client.summaries['!abc'] = { name: 'Support', alias: '#support:example.org', joinedMembers: 3 };
    expect(await check('#support:example.org')).toEqual({ roomId: '!abc', name: 'Support', alias: '#support:example.org', members: 3 });
  });

  it('still confirms the room when its name cannot be read', async () => {
    expect(await check('#support:example.org')).toEqual({ roomId: '!abc', name: null, alias: null, members: null });
  });

  it('explains a room the bot may not join, and a malformed one, as saving does', async () => {
    await expect(check('!other')).rejects.toThrow('Invite @helpdesk:example.org to the room first');
    await expect(check('support')).rejects.toThrow('Type the room\'s ID');
  });

  it("refuses another workspace's room, typed by address, without joining it", async () => {
    await rooms.save(room({ id: 'theirs', workspaceId: 'ws-2', roomId: '!abc' }));
    await expect(check('#support:example.org')).rejects.toThrow('Another workspace already sends its notices to that room');
    expect(client.joined).toEqual([]);
    expect((await check('#support:example.org', true)).roomId).toBe('!abc');
  });

  it('checks a room the workspace already uses, also one shared with another workspace', async () => {
    await rooms.save(room({ id: 'theirs', workspaceId: 'ws-2', roomId: '!abc' }));
    await rooms.save(room({ id: 'ours', workspaceId: 'ws-1', roomId: '!abc' }));
    expect((await check('#support:example.org')).roomId).toBe('!abc');
  });

  it('explains an address the server does not know', async () => {
    await expect(check('#nowhere:example.org')).rejects.toThrow('The Matrix server does not know that room');
  });
});

describe('Looking at a saved Matrix room without entering it', () => {
  let bots: MockMatrixBotRepository;
  let rooms: MockMatrixRoomRepository;
  let client: FakeMatrixClient;
  const inspect = (id = 'room-1') => new InspectMatrixRoom(bots, rooms, client, cipher).execute({ workspaceId: 'ws-1', id });
  const leaveChecked = (room: string) => new LeaveCheckedMatrixRoom(bots, rooms, client, cipher).execute({ workspaceId: 'ws-1', room });

  beforeEach(async () => {
    bots = new MockMatrixBotRepository();
    rooms = new MockMatrixRoomRepository();
    client = new FakeMatrixClient();
    client.tokens.tok = '@helpdesk:example.org';
    client.joinable['#support:example.org'] = '!abc';
    await bots.save(installationBot());
    await rooms.save(room());
  });

  it('tells the name and members while the bot is in the room', async () => {
    client.memberships['!abc'] = { '@helpdesk:example.org': 'join' };
    client.summaries['!abc'] = { name: 'Support', alias: null, joinedMembers: 4 };
    expect(await inspect()).toEqual({ roomId: '!abc', inRoom: true, name: 'Support', alias: null, members: 4 });
  });

  it('says the bot is out, and never joins again, when it was taken out of the room', async () => {
    client.memberships['!abc'] = { '@helpdesk:example.org': 'leave' };
    expect((await inspect()).inRoom).toBe(false);
    client.membershipFailures['!abc'] = new MatrixApiError(403, 'M_FORBIDDEN', 'You are not in the room');
    expect((await inspect()).inRoom).toBe(false);
    expect(client.joined).toEqual([]);
  });

  it('does not show another workspace\'s room', async () => {
    await rooms.save(room({ id: 'theirs', workspaceId: 'ws-2' }));
    await expect(inspect('theirs')).rejects.toThrow(EntityNotFoundError);
  });

  it('leaves a room it only checked, but not one the same bot writes in', async () => {
    expect(await leaveChecked('!new')).toEqual({ left: true });
    expect(await leaveChecked('#support:example.org')).toEqual({ left: false });
    expect(client.left).toEqual(['!new']);
  });
});

describe('Delivering a Matrix notice', () => {
  let rooms: MockMatrixRoomRepository;
  let threads: MockMatrixTicketThreadRepository;
  let client: FakeMatrixClient;
  let audit: MockAuditLogRepository;
  let waits: number[];
  const deliver = () => new DeliverMatrixNotice(new FakeIdGenerator('id'), client, cipher, rooms, threads, audit, async (ms) => { waits.push(ms); });
  const content = (root: string | null) => ({ msgtype: 'm.notice', body: 'hi', root });

  beforeEach(async () => {
    rooms = new MockMatrixRoomRepository();
    threads = new MockMatrixTicketThreadRepository();
    client = new FakeMatrixClient();
    audit = new MockAuditLogRepository();
    waits = [];
    await rooms.save(room());
  });

  it('opens the ticket\'s thread with its first notice and answers in it afterwards', async () => {
    const first = await deliver().execute({ room: room(), bot: installationBot(), content, txnId: 't1', ticketId: 'ticket-1', opensThread: true });
    expect(first).toEqual({ sent: true, eventId: '$event-1', threadRootEventId: '$event-1' });
    expect(threads.threads[0]).toMatchObject({ ticketId: 'ticket-1', roomId: '!abc', rootEventId: '$event-1' });

    await deliver().execute({ room: room(), bot: installationBot(), content, txnId: 't2', ticketId: 'ticket-1' });
    expect(client.sent.map((s) => [s.token, s.txnId, s.content.root])).toEqual([['tok', 't1', null], ['tok', 't2', '$event-1']]);
  });

  it('makes a notice the root when the ticket has no thread in that room yet', async () => {
    await deliver().execute({ room: room(), bot: installationBot(), content, txnId: 't1', ticketId: 'ticket-9' });
    expect(client.sent[0].content.root).toBeNull();
    expect(threads.threads[0].rootEventId).toBe('$event-1');
  });

  it('waits as long as the server asks and sends again with the same transaction', async () => {
    client.sendFailures = [new MatrixApiError(429, 'M_LIMIT_EXCEEDED', 'Too many requests', 1500), new MatrixApiError(502, null, 'Bad gateway')];
    const result = await deliver().execute({ room: room(), bot: installationBot(), content, txnId: 't1', ticketId: null });
    expect(result.sent).toBe(true);
    expect(waits).toEqual([1500, 4000]);
    expect(client.sent.map((s) => s.txnId)).toEqual(['t1']);
  });

  it('gives up after three attempts, notes the error and keeps the room active', async () => {
    client.sendFailures = [0, 1, 2].map(() => new MatrixApiError(0, null, 'offline'));
    const result = await deliver().execute({ room: room(), bot: installationBot(), content, txnId: 't1', ticketId: null });
    expect(result).toEqual({ sent: false, error: 'offline', lostAccess: false });
    const saved = await rooms.findById('room-1');
    expect(saved?.isActive).toBe(true);
    expect(saved?.lastError).toBe('offline');
    expect(audit.entries).toEqual([]);
  });

  it('pauses the room once when the bot lost access, with a single audit entry', async () => {
    client.sendFailures = [new MatrixApiError(403, 'M_FORBIDDEN', 'User not in room'), new MatrixApiError(403, 'M_FORBIDDEN', 'User not in room')];
    const current = room();
    await deliver().execute({ room: current, bot: installationBot(), content, txnId: 't1', ticketId: null });
    await deliver().execute({ room: current, bot: installationBot(), content, txnId: 't2', ticketId: null });

    expect((await rooms.findById('room-1'))?.isActive).toBe(false);
    expect(audit.entries.map((e) => e.action)).toEqual([AuditAction.MATRIX_ROOM_PAUSED]);
  });

  it('pauses the room when the saved token can no longer be read, without calling the server', async () => {
    const unreadable = new MatrixBot({ id: 'bot-1', workspaceId: null, homeserverUrl: 'https://m.example.org', userId: '@helpdesk:example.org', deviceId: null, encryptedAccessToken: 'garbled' });
    const result = await deliver().execute({ room: room(), bot: unreadable, content, txnId: 't1', ticketId: null });
    expect(result).toMatchObject({ sent: false, lostAccess: true });
    expect(client.sent).toEqual([]);
  });
});

describe('Testing the Matrix room', () => {
  const noScope = () => new FindMatrixRoomScope(new MockDepartmentRepository(), new MockProjectRepository(), new MockOrganizationRepository());

  it('sends a notice in the workspace\'s language and resumes a paused room when it arrives', async () => {
    const rooms = new MockMatrixRoomRepository();
    const bots = new MockMatrixBotRepository();
    const client = new FakeMatrixClient();
    const workspaces = new MockWorkspaceRepository();
    await workspaces.create(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '', defaultLanguage: 'es' } as any));
    await bots.save(installationBot());
    await rooms.save(room({ isActive: false, lastError: 'Forbidden' }));
    const deliver = new DeliverMatrixNotice(new FakeIdGenerator(), client, cipher, rooms, new MockMatrixTicketThreadRepository(), new MockAuditLogRepository());

    const result = await new SendMatrixPlainNotice(rooms, bots, workspaces, deliver).test('ws-1', 'room-1', noScope());

    expect(result.sent).toBe(true);
    expect(String(client.sent[0].content.body)).toContain('esta sala recibirá los avisos del workspace Acme');
    expect((await rooms.findById('room-1'))).toMatchObject({ isActive: true, lastError: null });
  });

  it('names the department a department room is for, and falls back to the workspace once it is deleted', async () => {
    const rooms = new MockMatrixRoomRepository();
    const bots = new MockMatrixBotRepository();
    const client = new FakeMatrixClient();
    const workspaces = new MockWorkspaceRepository();
    const departments = new MockDepartmentRepository();
    await workspaces.create(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '', defaultLanguage: 'en' } as any));
    await departments.create(new Department({ id: 'dep-it', name: 'IT', description: null, workspaceId: 'ws-1' }));
    await bots.save(installationBot());
    await rooms.save(room({ departmentId: 'dep-it' }));
    const deliver = new DeliverMatrixNotice(new FakeIdGenerator(), client, cipher, rooms, new MockMatrixTicketThreadRepository(), new MockAuditLogRepository());
    const plain = new SendMatrixPlainNotice(rooms, bots, workspaces, deliver);
    const findScope = new FindMatrixRoomScope(departments, new MockProjectRepository(), new MockOrganizationRepository());

    const result = await plain.test('ws-1', 'room-1', findScope);
    expect(result.scopeName).toBe('IT');
    expect(String(client.sent[0].content.body)).toContain('notices of the department IT in the workspace Acme');

    departments.departments = [];
    const after = await plain.test('ws-1', 'room-1', findScope);
    expect(after.scopeName).toBeNull();
    expect(String(client.sent[1].content.body)).toContain("this room will receive the workspace Acme's notices");
  });

  it('only tests a room of the workspace', async () => {
    const rooms = new MockMatrixRoomRepository();
    await rooms.save(room({ workspaceId: 'ws-2' }));
    const deliver = new DeliverMatrixNotice(new FakeIdGenerator(), new FakeMatrixClient(), cipher, rooms, new MockMatrixTicketThreadRepository(), new MockAuditLogRepository());
    await expect(new SendMatrixPlainNotice(rooms, new MockMatrixBotRepository(), new MockWorkspaceRepository(), deliver).test('ws-1', 'room-1', noScope())).rejects.toBeInstanceOf(EntityNotFoundError);
  });
});

describe('Pausing and removing one Matrix room', () => {
  let bots: MockMatrixBotRepository;
  let client: FakeMatrixClient;
  let workspaces: MockWorkspaceRepository;
  const remove = (rooms: MockMatrixRoomRepository) => new RemoveMatrixRoom(rooms, new LeaveMatrixRoom(rooms, bots, workspaces, client, cipher));

  beforeEach(async () => {
    bots = new MockMatrixBotRepository();
    client = new FakeMatrixClient();
    workspaces = new MockWorkspaceRepository();
    await workspaces.create(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '', defaultLanguage: 'es' } as any));
    await bots.save(installationBot());
  });

  it('pauses a room until a test notice reaches it, and removes only that room', async () => {
    const rooms = new MockMatrixRoomRepository();
    await rooms.save(room());
    await rooms.save(room({ id: 'room-2', roomId: '!two', projectId: 'prj-web' }));
    expect(await new PauseMatrixRoom(rooms).execute('ws-1', 'room-2')).toMatchObject({ isActive: false });
    expect((await rooms.findById('room-1'))?.isActive).toBe(true);

    const { left } = await remove(rooms).execute('ws-1', 'room-2');
    expect(rooms.rooms.map((r) => r.getId())).toEqual(['room-1']);
    // Unless asked, the bot stays in the room
    expect(left).toBeNull();
    expect(client.left).toEqual([]);
  });

  it("says goodbye in the workspace's language and leaves the room when asked", async () => {
    const rooms = new MockMatrixRoomRepository();
    await rooms.save(room());
    const { left } = await remove(rooms).execute('ws-1', 'room-1', true);
    expect(left).toEqual({ left: true, error: null });
    expect(client.sent.map((m) => [m.roomId, m.content.body])).toEqual([['!abc', 'ℹ️ Open Helpdesk ya no envía avisos a esta sala.']]);
    expect(client.left).toEqual(['!abc']);
    expect(rooms.rooms).toEqual([]);
  });

  it("stays while the same bot still writes there for another workspace, not for another bot's", async () => {
    const rooms = new MockMatrixRoomRepository();
    await rooms.save(room());
    await rooms.save(room({ id: 'room-ws2', workspaceId: 'ws-2' }));
    const { left } = await remove(rooms).execute('ws-1', 'room-1', true);
    expect(left).toEqual({ left: false, error: "The same bot still sends another workspace's notices to that room" });
    expect(client.left).toEqual([]);
    expect(rooms.rooms.map((r) => r.getId())).toEqual(['room-ws2']);

    await rooms.save(room());
    await bots.save(new MatrixBot({ ...installationBot(), id: 'bot-ws2', workspaceId: 'ws-2', userId: '@ws2:example.org' } as any));
    expect((await remove(rooms).execute('ws-1', 'room-1', true)).left).toEqual({ left: true, error: null });
  });

  it('removes the room even when the bot cannot leave it, and says why', async () => {
    const rooms = new MockMatrixRoomRepository();
    await rooms.save(room());
    client.sendFailures.push(new MatrixApiError(403, 'M_FORBIDDEN', 'Forbidden'));
    client.leaveFailure = new MatrixApiError(0, null, 'The Matrix server did not answer');
    const { left } = await remove(rooms).execute('ws-1', 'room-1', true);
    expect(left).toEqual({ left: false, error: 'The Matrix server did not answer' });
    expect(rooms.rooms).toEqual([]);
  });

  it('does not touch another workspace\'s room', async () => {
    const rooms = new MockMatrixRoomRepository();
    await rooms.save(room({ workspaceId: 'ws-2' }));
    await expect(new PauseMatrixRoom(rooms).execute('ws-1', 'room-1')).rejects.toBeInstanceOf(EntityNotFoundError);
    await expect(remove(rooms).execute('ws-1', 'room-1', true)).rejects.toBeInstanceOf(EntityNotFoundError);
    expect(client.left).toEqual([]);
    expect(rooms.rooms).toHaveLength(1);
  });
});

describe('The Matrix settings of a workspace', () => {
  it('list every room with what it is for, the room of the whole workspace first; a deleted project shows no name', async () => {
    const rooms = new MockMatrixRoomRepository();
    const projects = new MockProjectRepository();
    const organizations = new MockOrganizationRepository();
    await organizations.create(new Organization({ id: 'org-acme', name: 'Acme Ltd', description: null, notes: null, logo: null, domains: [], workspaceId: 'ws-1' }));
    await rooms.save(room({ id: 'room-org', roomId: '!org', organizationId: 'org-acme' }));
    await rooms.save(room({ id: 'room-gone', roomId: '!gone', projectId: 'prj-gone' }));
    await rooms.save(room({ onlyTicketsWithoutOtherRoom: true }));

    const settings = await new GetMatrixSettingsQuery(new MockMatrixBotRepository(), rooms, cipher, new FindMatrixRoomScope(new MockDepartmentRepository(), projects, organizations)).execute({ workspaceId: 'ws-1' });

    expect(settings.rooms.map((r) => [r.id, r.scope, r.scopeId, r.scopeName])).toEqual([
      ['room-1', 'workspace', null, null],
      ['room-org', 'organization', 'org-acme', 'Acme Ltd'],
      ['room-gone', 'project', 'prj-gone', null],
    ]);
    expect(settings.rooms[0].onlyTicketsWithoutOtherRoom).toBe(true);
    expect(settings.room?.id).toBe('room-1');
  });
});
