import { NoticePreference } from '../../../src/notification/domain/entities/notice-preference';
import { Notification } from '../../../src/notification/domain/entities/notification';
import { NotificationPreference } from '../../../src/notification/domain/entities/notification-preference';
import { MATRIX_STANDALONE_NOTICE_EVENT } from '../../../src/notification/domain/matrix-personal-notice';
import { NoticeCatalog } from '../../../src/notification/domain/notice-catalog';
import { NoticeKind } from '../../../src/notification/domain/notice-kind';
import { SendNotice, SendNoticeProps } from '../../../src/notification/domain/services/notice-send';
import { SendEmailParams } from '../../../src/email/domain/email.service';
import { User } from '../../../src/user/domain/entities/user';
import { WorkspaceMember } from '../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { FakeEventPublisher } from '../../mocks/fake-event-publisher';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockAuditLogRepository } from '../../mocks/mock-audit-log.repository';
import { MockNoticePreferenceRepository } from '../../mocks/mock-notice-preference.repository';
import { MockNotificationPreferenceRepository } from '../../mocks/mock-notification-preference.repository';
import { MockUserRepository } from '../../mocks/mock-user.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';

const user = (id: string, overrides: Partial<ConstructorParameters<typeof User>[0]> = {}) => new User({
  id, email: `${id}@acme.test`, password: 'hashed', firstName: id, lastName: 'Test',
  isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system', ...overrides,
});

const general = (userId: string, overrides: Partial<ConstructorParameters<typeof NotificationPreference>[0]> = {}) => new NotificationPreference({
  id: `pref-${userId}`, userId, emailEnabled: true, inAppEnabled: true,
  emailTicketCreated: true, emailTicketAssigned: true, emailStatusChanged: true, emailCommentCreated: true, emailCsatSurvey: true, emailTransferRequest: true,
  inAppTicketCreated: true, inAppTicketAssigned: true, inAppStatusChanged: true, inAppTicketUnassigned: true, inAppCommentCreated: true, inAppTransferRequest: true,
  emailUpgradeAvailable: true, inAppUpgradeAvailable: true, bellUnreadOnly: false, ...overrides,
});

const kind = (overrides: Partial<NoticeKind> = {}): NoticeKind => ({
  key: 'member-joined',
  audience: 'workspace-admins',
  label: { en: 'New team member', es: 'Nuevo miembro' },
  description: { en: '', es: '' },
  headline: { en: '{who} joined {workspace}', es: '{who} entró en {workspace}' },
  action: { en: 'See the team', es: 'Ver el equipo' },
  icon: '👋',
  defaults: { inApp: true, email: true, matrix: true },
  ...overrides,
});

// Acme (ws-1): Ana is an admin in English, Eva an admin in Spanish, Sam a supervisor, Pau an agent.
// Root is the installation's admin, and on no team.
describe('Sending a notice that is not about a ticket', () => {
  let general_: MockNotificationPreferenceRepository;
  let chosen: MockNoticePreferenceRepository;
  let users: MockUserRepository;
  let members: MockWorkspaceMemberRepository;
  let audit: MockAuditLogRepository;
  let events: FakeEventPublisher;
  let created: Notification[];
  let emails: SendEmailParams[];

  const send = (props: Partial<SendNoticeProps> = {}, kinds: NoticeKind[] = [kind()]) => new SendNotice(
    new NoticeCatalog(kinds),
    new FakeIdGenerator(),
    { create: async (n: Notification) => { created.push(n); } } as never,
    general_,
    chosen,
    users,
    members,
    { send: async (params: SendEmailParams) => { emails.push(params); return { success: true }; } },
    audit,
    events,
    async (workspaceId) => (workspaceId ? 'https://help.acme.test' : 'https://helpdesk.example.org'),
  ).execute({
    kind: 'member-joined',
    workspace: { id: 'ws-1', slug: 'acme' },
    data: { who: 'Leo', workspace: 'Acme' },
    path: '/dashboard/workspaces/acme/members',
    ...props,
  });

  const inApp = () => created.map((n) => `${n.userId}:${n.title}`);
  const emailedTo = () => emails.map((e) => String(e.to));

  beforeEach(() => {
    general_ = new MockNotificationPreferenceRepository();
    chosen = new MockNoticePreferenceRepository();
    users = new MockUserRepository();
    members = new MockWorkspaceMemberRepository();
    audit = new MockAuditLogRepository();
    events = new FakeEventPublisher();
    created = [];
    emails = [];
    users.seed(user('ana'));
    users.seed(user('eva', { language: 'es' }));
    users.seed(user('sam'));
    users.seed(user('pau'));
    users.seed(user('root', { isSystemAdmin: true }));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'ana', role: WorkspaceRole.ADMIN }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'eva', role: WorkspaceRole.ADMIN }));
    members.seed(new WorkspaceMember({ id: 'm-3', workspaceId: 'ws-1', userId: 'sam', role: WorkspaceRole.SUPERVISOR }));
    members.seed(new WorkspaceMember({ id: 'm-4', workspaceId: 'ws-1', userId: 'pau', role: WorkspaceRole.AGENT }));
  });

  it('tells the workspace\'s admins, and only them, in the app and by email, each in their language', async () => {
    const sent = await send();

    expect(inApp()).toEqual(['ana:Leo joined Acme', 'eva:Leo entró en Acme']);
    expect(created[0]).toMatchObject({ type: 'member-joined', ticketId: null, workspaceSlug: 'acme', link: '/dashboard/workspaces/acme/members' });
    expect(emailedTo()).toEqual(['ana@acme.test', 'eva@acme.test']);
    expect(emails[1].subject).toBe('Leo entró en Acme');
    expect(emails[0].html).toContain('href="https://help.acme.test/dashboard/workspaces/acme/members"');
    expect(sent).toEqual({ inApp: ['ana', 'eva'], email: ['ana', 'eva'], matrix: [] });
  });

  it('records each email in the audit log as a notice', async () => {
    await send();
    expect(audit.entries.map((e) => e.metadata)).toEqual([
      expect.objectContaining({ type: 'notice', to: ['ana@acme.test'] }),
      expect.objectContaining({ type: 'notice', to: ['eva@acme.test'] }),
    ]);
  });

  it('leaves out whoever caused it, and anyone deactivated', async () => {
    await users.update(Object.assign(user('eva', { language: 'es' }), { isActive: false }));
    await send({ exclude: ['ana'] });
    expect(created).toEqual([]);
    expect(emails).toEqual([]);
  });

  it('follows what each person chose for this kind, on each channel', async () => {
    await chosen.save(new NoticePreference({ id: 'c-1', userId: 'ana', kind: 'member-joined', channel: 'email', enabled: false }));
    await chosen.save(new NoticePreference({ id: 'c-2', userId: 'eva', kind: 'member-joined', channel: 'inApp', enabled: false }));
    await send();
    expect(inApp()).toEqual(['ana:Leo joined Acme']);
    expect(emailedTo()).toEqual(['eva@acme.test']);
  });

  it('uses the kind\'s defaults for whoever has not chosen', async () => {
    await send({}, [kind({ defaults: { inApp: true, email: false, matrix: false } })]);
    expect(inApp()).toHaveLength(2);
    expect(emails).toEqual([]);
  });

  it('keeps within a channel someone turned off altogether', async () => {
    general_.seed(general('ana', { emailEnabled: false }));
    await send();
    expect(emailedTo()).toEqual(['eva@acme.test']);
  });

  it('always sends a mandatory channel, and says so in the email', async () => {
    general_.seed(general('ana', { emailEnabled: false }));
    await chosen.save(new NoticePreference({ id: 'c-1', userId: 'eva', kind: 'member-joined', channel: 'email', enabled: false }));
    await send({}, [kind({ mandatory: ['email'] })]);
    expect(emailedTo()).toEqual(['ana@acme.test', 'eva@acme.test']);
    expect(emails[0].html).toContain('always sent by email');
  });

  it('asks Matrix for those who turned it on, with the notice in each language', async () => {
    general_.seed(general('ana', { matrixEnabled: true }));
    const sent = await send();
    expect(sent.matrix).toEqual(['ana']);
    expect(events.events).toEqual([{
      event: MATRIX_STANDALONE_NOTICE_EVENT,
      data: {
        kind: 'member-joined', userIds: ['ana'], workspaceId: 'ws-1', icon: '👋',
        headline: { en: 'Leo joined Acme', es: 'Leo entró en Acme' },
        action: { en: 'See the team', es: 'Ver el equipo' },
        path: '/dashboard/workspaces/acme/members',
      },
    }]);
  });

  it('never on Matrix to someone who has not turned it on, even when mandatory', async () => {
    await send({}, [kind({ mandatory: ['matrix'] })]);
    expect(events.events).toEqual([]);
  });

  it('goes to the installation\'s admins, with the installation\'s address, for a kind about no workspace', async () => {
    await send({ kind: 'user-signed-up', workspace: null, path: '/dashboard/admin/users' }, [kind({ key: 'user-signed-up', audience: 'system-admins' })]);
    expect(inApp()).toEqual(['root:Leo joined Acme']);
    expect(created[0].workspaceSlug).toBe('');
    expect(emails[0].html).toContain('href="https://helpdesk.example.org/dashboard/admin/users"');
  });

  it('goes to the people named, for a kind sent to given people', async () => {
    await send({ kind: 'payment-failed', userIds: ['pau'] }, [kind({ key: 'payment-failed', audience: 'given' })]);
    expect(inApp()).toEqual(['pau:Leo joined Acme']);
  });

  it('refuses a kind nobody declared', async () => {
    await expect(send({ kind: 'nope' })).rejects.toThrow('Unknown notice kind "nope"');
  });
});
