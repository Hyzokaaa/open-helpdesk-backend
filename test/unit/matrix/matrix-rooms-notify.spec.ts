import { MatrixBot } from '../../../src/matrix/domain/entities/matrix-bot';
import { MatrixRoom } from '../../../src/matrix/domain/entities/matrix-room';
import { MatrixNoticeEvent } from '../../../src/matrix/domain/enums/matrix-notice-event.enum';
import { MatrixNoticeThrottle } from '../../../src/matrix/domain/matrix-notice-throttle';
import { DeliverMatrixNotice } from '../../../src/matrix/domain/services/matrix-notice-deliver';
import { NotifyMatrixRooms } from '../../../src/matrix/domain/services/matrix-rooms-notify';
import { Ticket } from '../../../src/ticket/domain/entities/ticket';
import { TicketPriority } from '../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../src/ticket/domain/enums/ticket-status.enum';
import { User } from '../../../src/user/domain/entities/user';
import { Workspace } from '../../../src/workspace/domain/entities/workspace';
import { WorkspaceMember } from '../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { Department } from '../../../src/department/domain/entities/department';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockAuditLogRepository } from '../../mocks/mock-audit-log.repository';
import { MockTicketRepository } from '../../mocks/mock-ticket.repository';
import { MockUserRepository } from '../../mocks/mock-user.repository';
import { MockDepartmentRepository } from '../../mocks/mock-department.repository';
import { MockWorkspaceRepository } from '../../mocks/mock-workspace.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';
import { MatrixApiError } from '../../../src/matrix/domain/matrix-client';
import { FakeMatrixClient, FakeMatrixFileSource, FakeSecretCipher, MockMatrixBotRepository, MockMatrixRoomRepository, MockMatrixTicketThreadRepository } from '../../mocks/mock-matrix';

const user = (id: string, firstName: string) => new User({
  id, email: `${id}@acme.test`, password: 'hashed', firstName, lastName: 'Test',
  isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
});

const ticket = (overrides: Partial<ConstructorParameters<typeof Ticket>[0]> = {}) => new Ticket({
  id: 'ticket-1', name: 'Printer on fire', description: '<p>The printer <b>burns</b>. My password is hunter2.</p>',
  priority: TicketPriority.HIGH, status: TicketStatus.OPEN, categoryId: 'cat', workspaceId: 'ws-1', reporterId: 'bob',
  assigneeId: null, ticketNumber: 7, tagIds: [], customFields: {}, discardReason: null, resolvedAt: null, resolvedById: null,
  createdAt: new Date(), deletedAt: null, ...overrides,
});

// Acme (ws-1, Spanish off: English) has one room for every ticket; Bob is a customer, Ana an agent.
describe('Notifying the Matrix rooms of a ticket', () => {
  let rooms: MockMatrixRoomRepository;
  let tickets: MockTicketRepository;
  let departments: MockDepartmentRepository;
  let client: FakeMatrixClient;
  let threads: MockMatrixTicketThreadRepository;
  let throttle: MatrixNoticeThrottle;
  let notify: NotifyMatrixRooms;
  let files: FakeMatrixFileSource;

  const room = (overrides: Partial<ConstructorParameters<typeof MatrixRoom>[0]> = {}) => new MatrixRoom({
    id: 'room-1', workspaceId: 'ws-1', roomId: '!acme', departmentId: null,
    events: [MatrixNoticeEvent.TICKET_CREATED, MatrixNoticeEvent.UNATTENDED_REPLY, MatrixNoticeEvent.SLA_BREACHED],
    includeText: false, includeFiles: false, isActive: true, lastError: null, lastErrorAt: null, ...overrides,
  });
  const base = { workspaceId: 'ws-1', ticketId: 'ticket-1' };
  const bodies = () => client.sent.map((s) => String(s.content.body));

  beforeEach(async () => {
    rooms = new MockMatrixRoomRepository();
    tickets = new MockTicketRepository();
    departments = new MockDepartmentRepository();
    client = new FakeMatrixClient();
    threads = new MockMatrixTicketThreadRepository();
    throttle = new MatrixNoticeThrottle();
    files = new FakeMatrixFileSource();
    const bots = new MockMatrixBotRepository();
    const users = new MockUserRepository();
    const workspaces = new MockWorkspaceRepository();
    const members = new MockWorkspaceMemberRepository();

    await bots.save(new MatrixBot({ id: 'bot', workspaceId: null, homeserverUrl: 'https://m.example.org', userId: '@helpdesk:example.org', deviceId: null, encryptedAccessToken: 'enc:tok' }));
    await rooms.save(room());
    await tickets.create(ticket());
    users.seed(user('bob', 'Bob'));
    users.seed(user('ana', 'Ana'));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'ana', role: WorkspaceRole.AGENT }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'bob', role: WorkspaceRole.USER }));
    await workspaces.create(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    await departments.create(new Department({ id: 'dep-it', name: 'IT', description: null, workspaceId: 'ws-1' }));

    const deliver = new DeliverMatrixNotice(new FakeIdGenerator(), client, new FakeSecretCipher(), rooms, threads, new MockAuditLogRepository());
    notify = new NotifyMatrixRooms(rooms, bots, tickets, users, departments, workspaces, members, async () => 'https://help.acme.test', throttle, deliver, files);
  });

  it('announces a new ticket with its reference, subject, priority, reporter and link', async () => {
    expect(await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'created' })).toBe(1);
    expect(bodies()[0]).toBe('🎫 New ticket TK-000007 · Printer on fire\nPriority: high · Reported by: Bob Test\nhttps://help.acme.test/dashboard/workspaces/acme/tickets/ticket-1');
    expect(client.sent[0].txnId).toBe('ohd-ticket-created-ticket-1-created');
  });

  it('never carries the ticket\'s text unless the room asked for it, and then only its start', async () => {
    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'created' });
    expect(JSON.stringify(client.sent[0].content)).not.toContain('hunter2');

    await rooms.save(room({ includeText: true }));
    await tickets.update(ticket({ id: 'ticket-1', description: `<p>${'word '.repeat(200)}</p>` }));
    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'again' });
    const quoted = String(client.sent[1].content.body).split('\n').filter((l) => l.startsWith('> ')).join('');
    expect(quoted.length).toBeLessThanOrEqual(310);
    expect(quoted.endsWith('...')).toBe(true);
  });

  it('tells only the rooms that hear of that kind of change', async () => {
    expect(await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_ASSIGNED, assigneeId: 'ana', occurrence: 'a' })).toBe(0);
    await rooms.save(room({ events: [MatrixNoticeEvent.TICKET_ASSIGNED] }));
    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_ASSIGNED, assigneeId: 'ana', occurrence: 'a' });
    expect(bodies()[0]).toContain('👤 TK-000007 assigned to Ana Test');
  });

  it('skips paused rooms, deleted tickets, and tickets of other workspaces', async () => {
    await rooms.save(room({ isActive: false }));
    expect(await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' })).toBe(0);
    await rooms.save(room());
    await tickets.update(ticket({ deletedAt: new Date() }));
    expect(await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' })).toBe(0);
    await tickets.update(ticket({ workspaceId: 'ws-2' }));
    expect(await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' })).toBe(0);
  });

  it('does not announce tickets made from old emails, as when a mailbox is read for the first time', async () => {
    await tickets.update(ticket({ originDate: new Date(Date.now() - 3 * 24 * 3600 * 1000) }));
    expect(await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' })).toBe(0);
  });

  it('tells of customer replies to unassigned tickets; the team\'s comments are not customer replies', async () => {
    const reply = (authorId: string) => ({ ...base, event: MatrixNoticeEvent.CUSTOMER_REPLY as const, authorId, commentId: `c-${authorId}`, commentText: 'Still burning', occurrence: `c-${authorId}` });
    expect(await notify.execute(reply('ana'))).toBe(0);
    expect(await notify.execute(reply('bob'))).toBe(1);
    expect(bodies()[0]).toContain('📣 Unattended reply from Bob Test on TK-000007');
    expect(bodies()[0]).not.toContain('Still burning');

    await tickets.update(ticket({ assigneeId: 'ana' }));
    expect(await notify.execute(reply('bob'))).toBe(0);
    await rooms.save(room({ events: [MatrixNoticeEvent.CUSTOMER_REPLY] }));
    expect(await notify.execute({ ...reply('bob'), occurrence: 'c-2' })).toBe(1);
    expect(bodies()[1]).toContain('💬 Reply from Bob Test on TK-000007');
  });

  it('threads later notices under the new ticket\'s one', async () => {
    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'created' });
    await notify.execute({ ...base, event: MatrixNoticeEvent.SLA_BREACHED, target: 'resolution', occurrence: 'resolution' });
    expect(client.sent[1].content['m.relates_to']).toMatchObject({ rel_type: 'm.thread', event_id: '$event-1' });
    expect(bodies()[1]).toContain('⏰ TK-000007 missed its resolution target');
  });

  it('keeps a department\'s room to its own tickets', async () => {
    await rooms.save(room({ departmentId: 'dep-it' }));
    expect(await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' })).toBe(0);
    await tickets.update(ticket({ departmentId: 'dep-it' }));
    expect(await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' })).toBe(1);
    expect(bodies()[0]).toContain('Department: IT');
  });

  describe('rooms for a department, a project or an organization', () => {
    const created = (occurrence: string) => ({ ...base, event: MatrixNoticeEvent.TICKET_CREATED as const, occurrence });
    const told = () => client.sent.map((s) => s.roomId);

    beforeEach(async () => {
      await rooms.save(room({ id: 'room-org', roomId: '!org', organizationId: 'org-acme' }));
      await rooms.save(room({ id: 'room-web', roomId: '!web', projectId: 'prj-web' }));
      await rooms.save(room({ id: 'room-app', roomId: '!app', projectId: 'prj-app' }));
      await rooms.save(room({ id: 'room-it', roomId: '!it', departmentId: 'dep-it' }));
    });

    it('tells every room the ticket belongs to, and the room of the whole workspace', async () => {
      await tickets.update(ticket({ organizationId: 'org-acme', projectId: 'prj-web' }));
      expect(await notify.execute(created('c'))).toBe(3);
      expect(told()).toEqual(['!acme', '!org', '!web']);
    });

    it('lets the room of the whole workspace leave out the tickets another room tells of', async () => {
      await rooms.save(room({ onlyTicketsWithoutOtherRoom: true }));
      await tickets.update(ticket({ organizationId: 'org-acme' }));
      await notify.execute(created('c1'));
      expect(told()).toEqual(['!org']);

      // A ticket no other room is for still reaches it
      await tickets.update(ticket());
      await notify.execute(created('c2'));
      expect(told()).toEqual(['!org', '!acme']);
    });

    it('still tells the room of the whole workspace when the other room would not tell of it: other events, or paused', async () => {
      await rooms.save(room({ onlyTicketsWithoutOtherRoom: true }));
      await tickets.update(ticket({ organizationId: 'org-acme' }));
      await rooms.save(room({ id: 'room-org', roomId: '!org', organizationId: 'org-acme', events: [MatrixNoticeEvent.STATUS_CHANGED] }));
      await notify.execute(created('c1'));
      expect(told()).toEqual(['!acme']);

      await rooms.save(room({ id: 'room-org', roomId: '!org', organizationId: 'org-acme', isActive: false }));
      await notify.execute(created('c2'));
      expect(told()).toEqual(['!acme', '!acme']);
    });

    it('opens a thread in a project\'s room with the first notice of a ticket that moved into the project', async () => {
      await notify.execute(created('c'));
      expect(told()).toEqual(['!acme']);

      await tickets.update(ticket({ projectId: 'prj-web' }));
      const missed = (target: 'first-response' | 'resolution') => ({ ...base, event: MatrixNoticeEvent.SLA_BREACHED as const, target, occurrence: target });
      await notify.execute(missed('first-response'));
      expect(told()).toEqual(['!acme', '!acme', '!web']);
      expect(client.sent[1].content['m.relates_to']).toMatchObject({ rel_type: 'm.thread', event_id: '$event-1' });
      expect(client.sent[2].content['m.relates_to']).toBeUndefined();

      await notify.execute(missed('resolution'));
      expect(client.sent[4]).toMatchObject({ roomId: '!web', content: { 'm.relates_to': { rel_type: 'm.thread', event_id: '$event-3' } } });
    });
  });

  it('says where a status went from and to', async () => {
    await rooms.save(room({ events: [MatrixNoticeEvent.STATUS_CHANGED] }));
    await notify.execute({ ...base, event: MatrixNoticeEvent.STATUS_CHANGED, oldStatus: 'open', newStatus: 'in-progress', reopened: false, actorId: 'ana', occurrence: 's' });
    expect(bodies()[0]).toContain('🔄 TK-000007: open → in progress · Printer on fire');
    expect(bodies()[0]).toContain('By: Ana Test');

    await notify.execute({ ...base, event: MatrixNoticeEvent.STATUS_CHANGED, oldStatus: 'resolved', newStatus: 'pending', reopened: true, actorId: 'ana', occurrence: 'r' });
    expect(bodies()[1]).toContain('🔁 TK-000007 reopened: resolved → pending');
  });

  it('tells a status change that also assigned the ticket in one notice, to rooms that want either', async () => {
    const change = { ...base, event: MatrixNoticeEvent.STATUS_CHANGED as const, oldStatus: 'open', newStatus: 'pending', reopened: false, actorId: 'ana', assigneeChange: { newAssigneeId: 'ana' }, occurrence: 's' };
    await rooms.save(room({ events: [MatrixNoticeEvent.TICKET_ASSIGNED] }));
    expect(await notify.execute(change)).toBe(1);
    expect(bodies()[0]).toContain('🔄 TK-000007: open → pending · assigned to Ana Test');

    await notify.execute({ ...change, newStatus: 'open', oldStatus: 'pending', assigneeChange: { newAssigneeId: null }, occurrence: 's2' });
    expect(bodies()[1]).toContain('TK-000007: pending → open · unassigned');

    await rooms.save(room({ events: [MatrixNoticeEvent.TICKET_CREATED] }));
    expect(await notify.execute({ ...change, occurrence: 's3' })).toBe(0);
  });

  it('tells an assignment that also moved the status in one notice, to rooms that want either', async () => {
    const assigned = { ...base, event: MatrixNoticeEvent.TICKET_ASSIGNED as const, assigneeId: 'ana', statusChange: { oldStatus: 'open', newStatus: 'pending' }, occurrence: 'a' };
    await rooms.save(room({ events: [MatrixNoticeEvent.STATUS_CHANGED] }));
    expect(await notify.execute(assigned)).toBe(1);
    expect(bodies()[0]).toContain('👤 TK-000007 assigned to Ana Test · open → pending');
    // Without a status change, a room that only wants status changes does not hear of it
    expect(await notify.execute({ ...assigned, statusChange: undefined, occurrence: 'a2' })).toBe(0);
  });

  it('tells of the team\'s comments only to rooms that want them', async () => {
    const comment = { ...base, event: MatrixNoticeEvent.CUSTOMER_REPLY as const, authorId: 'ana', commentId: 'c-1', commentText: 'Replacing the fuser', occurrence: 'c-1' };
    await rooms.save(room({ events: [MatrixNoticeEvent.CUSTOMER_REPLY, MatrixNoticeEvent.UNATTENDED_REPLY] }));
    expect(await notify.execute(comment)).toBe(0);

    await rooms.save(room({ events: [MatrixNoticeEvent.TEAM_COMMENT], includeText: true }));
    expect(await notify.execute(comment)).toBe(1);
    expect(bodies()[0]).toContain('🗨️ Ana Test commented on TK-000007');
    expect(bodies()[0]).toContain('> Replacing the fuser');
    // A customer's reply is not a team comment
    expect(await notify.execute({ ...comment, authorId: 'bob', commentId: 'c-2', occurrence: 'c-2' })).toBe(0);
  });

  it('counts the files, and sends them only when the room asked for them', async () => {
    files.add('ticket-1', null, { id: 'shot', name: 'screenshot.png', mimeType: 'image/png' });
    files.add('ticket-1', null, { id: 'clip', name: 'clip.mp4', mimeType: 'video/mp4' });
    files.add('ticket-1', 'c-9', { id: 'other' });
    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' });
    expect(bodies()[0]).toContain('📎 2 attachments');
    expect(client.sent).toHaveLength(1);
    expect(client.uploads).toHaveLength(0);
  });

  it('sends the images and documents in the new ticket\'s thread, never videos', async () => {
    await rooms.save(room({ includeFiles: true }));
    files.add('ticket-1', null, { id: 'shot', name: 'screenshot.png', mimeType: 'image/png', size: 2048 });
    files.add('ticket-1', null, { id: 'clip', name: 'clip.mp4', mimeType: 'video/mp4' });
    files.add('ticket-1', null, { id: 'invoice', name: 'invoice.pdf', mimeType: 'application/pdf' });
    files.add('ticket-1', null, { id: 'sheet', name: 'costs.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' });
    expect(client.uploads.map((u) => u.fileName)).toEqual(['screenshot.png', 'invoice.pdf', 'costs.xlsx']);
    const [, image, pdf, sheet] = client.sent.map((s) => s.content);
    expect(image).toMatchObject({ msgtype: 'm.image', body: 'screenshot.png', url: 'mxc://example.org/1', info: { mimetype: 'image/png', size: 2048 } });
    expect(pdf).toMatchObject({ msgtype: 'm.file', body: 'invoice.pdf' });
    expect(sheet).toMatchObject({ msgtype: 'm.file' });
    for (const file of [image, pdf, sheet]) expect(file['m.relates_to']).toMatchObject({ rel_type: 'm.thread', event_id: '$event-1' });
    expect(client.sent[1].txnId).toBe('ohd-ticket-created-ticket-1-c-file-shot');
  });

  it('sends a reply\'s own files, in the thread the ticket already has', async () => {
    await rooms.save(room({ events: [MatrixNoticeEvent.TICKET_CREATED, MatrixNoticeEvent.CUSTOMER_REPLY], includeFiles: true }));
    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' });
    files.add('ticket-1', 'c-1', { id: 'photo', name: 'photo.jpg', mimeType: 'image/jpeg' });
    await notify.execute({ ...base, event: MatrixNoticeEvent.CUSTOMER_REPLY, authorId: 'bob', commentId: 'c-1', commentText: 'Look', occurrence: 'c-1' });
    expect(client.uploads.map((u) => u.fileName)).toEqual(['photo.jpg']);
    expect(client.sent[2].content['m.relates_to']).toMatchObject({ event_id: '$event-1' });
  });

  it('sends at most four files, and tells of one too large or one that fails instead of sending it', async () => {
    await rooms.save(room({ includeFiles: true }));
    files.add('ticket-1', null, { id: 'huge', name: 'huge.png', size: 11 * 1024 * 1024 });
    files.add('ticket-1', null, { id: 'gone', name: 'gone.png' }, null);
    files.add('ticket-1', null, { id: 'refused', name: 'refused.png' });
    files.add('ticket-1', null, { id: 'fine', name: 'fine.png' });
    files.add('ticket-1', null, { id: 'fifth', name: 'fifth.png' });
    client.uploadFailures = [new MatrixApiError(413, 'M_TOO_LARGE', 'Too large')];

    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' });
    expect(bodies()[0]).toContain('📎 5 attachments');
    expect(client.uploads.map((u) => u.fileName)).toEqual(['fine.png']);
    const notes = bodies().filter((b) => b.includes('could not be sent'));
    expect(notes).toEqual([
      '📎 huge.png could not be sent here: open the ticket to see it.',
      '📎 gone.png could not be sent here: open the ticket to see it.',
      '📎 refused.png could not be sent here: open the ticket to see it.',
    ]);
    expect(bodies().join()).not.toContain('fifth');
    expect((await rooms.findById('room-1'))?.isActive).toBe(true);
  });

  it('counts each file against the room\'s limit per minute', async () => {
    throttle = new MatrixNoticeThrottle(2);
    (notify as any).throttle = throttle;
    await rooms.save(room({ includeFiles: true }));
    files.add('ticket-1', null, { id: 'a' });
    files.add('ticket-1', null, { id: 'b' });
    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: 'c' });
    expect(client.uploads).toHaveLength(1);
  });

  it('stops at the room\'s limit per minute', async () => {
    throttle = new MatrixNoticeThrottle(1);
    (notify as any).throttle = throttle;
    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: '1' });
    await notify.execute({ ...base, event: MatrixNoticeEvent.TICKET_CREATED, occurrence: '2' });
    expect(client.sent).toHaveLength(1);
  });
});
