import { NoticeCatalog } from '../../../src/notification/domain/notice-catalog';
import { NoticeKind, noticeText } from '../../../src/notification/domain/notice-kind';
import { FindNoticePreferences } from '../../../src/notification/domain/services/notice-preferences-find';
import { UpdateNoticePreference } from '../../../src/notification/domain/services/notice-preference-update';
import { DomainValidationError, EntityNotFoundError } from '../../../src/shared/domain/errors';
import { User } from '../../../src/user/domain/entities/user';
import { WorkspaceMember } from '../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockNoticePreferenceRepository } from '../../mocks/mock-notice-preference.repository';
import { MockUserRepository } from '../../mocks/mock-user.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';

const kind = (key: string, audience: NoticeKind['audience'], overrides: Partial<NoticeKind> = {}): NoticeKind => ({
  key, audience,
  label: { en: key, es: key }, description: { en: '', es: '' }, headline: { en: '', es: '' }, action: { en: '', es: '' }, icon: '',
  defaults: { inApp: true, email: true, matrix: false },
  ...overrides,
});

const user = (id: string, isSystemAdmin = false) => new User({
  id, email: `${id}@acme.test`, password: 'hashed', firstName: id, lastName: 'Test',
  isActive: true, isSystemAdmin, isEmailVerified: true, language: 'en', theme: 'system',
});

describe('Choosing which notices that are not about a ticket to get', () => {
  const catalog = new NoticeCatalog([
    kind('member-joined', 'workspace-admins'),
    kind('user-signed-up', 'system-admins'),
    kind('payment-failed', 'given', { mandatory: ['email'] }),
  ]);
  let preferences: MockNoticePreferenceRepository;
  let users: MockUserRepository;
  let members: MockWorkspaceMemberRepository;
  let ids: FakeIdGenerator;

  const find = (userId: string) => new FindNoticePreferences(catalog, preferences, members, users).execute(userId);
  const update = (props: { kind: string; channel: 'inApp' | 'email' | 'matrix'; enabled: boolean }) =>
    new UpdateNoticePreference(catalog, ids, preferences).execute({ userId: 'ana', ...props });

  beforeEach(() => {
    preferences = new MockNoticePreferenceRepository();
    ids = new FakeIdGenerator();
    users = new MockUserRepository();
    members = new MockWorkspaceMemberRepository();
    users.seed(user('ana'));
    users.seed(user('pau'));
    users.seed(user('cli'));
    users.seed(user('root', true));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'ana', role: WorkspaceRole.ADMIN }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'pau', role: WorkspaceRole.AGENT }));
    members.seed(new WorkspaceMember({ id: 'm-3', workspaceId: 'ws-1', userId: 'cli', role: WorkspaceRole.USER }));
  });

  it('offers each person only the kinds that can reach them', async () => {
    expect((await find('ana')).map((k) => k.key)).toEqual(['member-joined', 'payment-failed']);
    expect((await find('pau')).map((k) => k.key)).toEqual(['payment-failed']);
    expect((await find('root')).map((k) => k.key)).toEqual(['user-signed-up', 'payment-failed']);
    expect(await find('cli')).toEqual([]);
  });

  it('shows the defaults until the person chooses, and a mandatory channel as on and locked', async () => {
    const [joined, payment] = await find('ana');
    expect(joined.channels).toEqual({
      inApp: { enabled: true, mandatory: false },
      email: { enabled: true, mandatory: false },
      matrix: { enabled: false, mandatory: false },
    });
    expect(payment.channels.email).toEqual({ enabled: true, mandatory: true });
  });

  it('keeps one choice per kind and channel', async () => {
    await update({ kind: 'member-joined', channel: 'email', enabled: false });
    await update({ kind: 'member-joined', channel: 'email', enabled: true });
    await update({ kind: 'member-joined', channel: 'matrix', enabled: true });

    expect(preferences.preferences.map((p) => `${p.kind}:${p.channel}:${p.enabled}`)).toEqual(['member-joined:email:true', 'member-joined:matrix:true']);
    expect((await find('ana'))[0].channels.matrix.enabled).toBe(true);
  });

  it('refuses to turn off a mandatory channel, or a kind nobody declared', async () => {
    await expect(update({ kind: 'payment-failed', channel: 'email', enabled: false })).rejects.toThrow(DomainValidationError);
    await expect(update({ kind: 'nope', channel: 'email', enabled: false })).rejects.toThrow(EntityNotFoundError);
  });

  it('catches a kind declared twice, as when an extension reuses a core key', () => {
    expect(() => new NoticeCatalog([kind('member-joined', 'given'), kind('member-joined', 'given')])).toThrow('declared twice');
  });

  it('fills a notice\'s text in each language, a value that differs by language too', () => {
    const text = { en: '{who} joined as {role}', es: '{who} entró como {role}' };
    const data = { who: 'Leo', role: { en: 'agent', es: 'agente' } };
    expect(noticeText(text, 'en', data)).toBe('Leo joined as agent');
    expect(noticeText(text, 'es', data)).toBe('Leo entró como agente');
    expect(noticeText(text, 'en', {})).toBe('{who} joined as {role}');
  });
});
