import { DispatchNotifications } from '../../../src/notification/domain/services/notification-dispatch';
import { DispatchCommentNotifications } from '../../../src/notification/domain/services/notification-dispatch-comment';
import { NotificationPreference } from '../../../src/notification/domain/entities/notification-preference';
import { Notification } from '../../../src/notification/domain/entities/notification';
import { MATRIX_PERSONAL_NOTICE_EVENT } from '../../../src/notification/domain/matrix-personal-notice';
import { User } from '../../../src/user/domain/entities/user';
import { WorkspaceMember } from '../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { FakeEventPublisher } from '../../mocks/fake-event-publisher';
import { MockNotificationPreferenceRepository } from '../../mocks/mock-notification-preference.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';

const user = (id: string) => new User({
  id, email: `${id}@acme.test`, password: 'hashed', firstName: id, lastName: 'Test',
  isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
});

const prefs = (userId: string, overrides: Partial<ConstructorParameters<typeof NotificationPreference>[0]> = {}) => new NotificationPreference({
  id: `pref-${userId}`, userId, emailEnabled: true, inAppEnabled: true,
  emailTicketCreated: true, emailTicketAssigned: true, emailStatusChanged: true, emailCommentCreated: true, emailCsatSurvey: true, emailTransferRequest: true,
  inAppTicketCreated: true, inAppTicketAssigned: true, inAppStatusChanged: true, inAppTicketUnassigned: true, inAppCommentCreated: true, inAppTransferRequest: true,
  emailUpgradeAvailable: true, inAppUpgradeAvailable: true, bellUnreadOnly: false, ...overrides,
});

describe('Telling of a new comment with mentions', () => {
  let preferences: MockNotificationPreferenceRepository;
  let members: MockWorkspaceMemberRepository;
  let events: FakeEventPublisher;
  let created: Notification[];

  const comment = (users: User[], mentionedUserIds: string[]) => new DispatchCommentNotifications(
    new DispatchNotifications(new FakeIdGenerator(), { create: async (n: Notification) => { created.push(n); } } as never, preferences, events),
    members,
  ).execute({ users, mentionedUserIds, authorName: 'Eva', ticketName: 'Printer', ticketId: 'ticket-1', workspaceId: 'ws-1', workspaceSlug: 'acme' });

  const inApp = () => created.map((n) => `${n.userId}:${n.type}`);
  const emailed = (r: Map<string, string[]>) => [...r.values()].flat();

  beforeEach(() => {
    preferences = new MockNotificationPreferenceRepository();
    members = new MockWorkspaceMemberRepository();
    events = new FakeEventPublisher();
    created = [];
    members.seed(new WorkspaceMember({ id: 'm-ana', workspaceId: 'ws-1', userId: 'ana', role: WorkspaceRole.AGENT }));
    members.seed(new WorkspaceMember({ id: 'm-bob', workspaceId: 'ws-1', userId: 'bob', role: WorkspaceRole.AGENT }));
    members.seed(new WorkspaceMember({ id: 'm-carla', workspaceId: 'ws-1', userId: 'carla', role: WorkspaceRole.USER }));
  });

  it('tells a mentioned team member they were mentioned, and the others of the comment, once each', async () => {
    const { mentioned, comment: rest } = await comment([user('ana'), user('bob'), user('carla')], ['ana']);

    expect(inApp()).toEqual(['ana:mentioned', 'bob:comment-created', 'carla:comment-created']);
    expect(emailed(mentioned.emailRecipients)).toEqual(['ana@acme.test']);
    expect(emailed(rest.emailRecipients)).toEqual(['bob@acme.test', 'carla@acme.test']);
  });

  it('gives a mentioned customer the comment, as any other: mentions are for the team', async () => {
    await comment([user('carla')], ['carla']);
    expect(inApp()).toEqual(['carla:comment-created']);
  });

  it('falls back to the comment on each channel where mentions are off', async () => {
    preferences.seed(prefs('ana', { emailMentioned: false }));
    const { mentioned, comment: rest } = await comment([user('ana')], ['ana']);

    expect(inApp()).toEqual(['ana:mentioned']);
    expect(emailed(mentioned.emailRecipients)).toEqual([]);
    expect(emailed(rest.emailRecipients)).toEqual(['ana@acme.test']);
  });

  it('reaches someone who silenced comments, when they want mentions', async () => {
    preferences.seed(prefs('ana', { inAppCommentCreated: false, emailCommentCreated: false }));
    const { mentioned } = await comment([user('ana')], ['ana']);

    expect(inApp()).toEqual(['ana:mentioned']);
    expect(emailed(mentioned.emailRecipients)).toEqual(['ana@acme.test']);
  });

  it('sends one Matrix notice per person: the mention, or else the comment', async () => {
    preferences.seed(prefs('ana', { matrixEnabled: true }));
    preferences.seed(prefs('bob', { matrixEnabled: true }));
    await comment([user('ana'), user('bob')], ['ana']);

    expect(events.events).toEqual([
      { event: MATRIX_PERSONAL_NOTICE_EVENT, data: { kind: 'mention', actorName: 'Eva', userIds: ['ana'], ticketId: 'ticket-1', workspaceSlug: 'acme' } },
      { event: MATRIX_PERSONAL_NOTICE_EVENT, data: { kind: 'comment', actorName: 'Eva', userIds: ['bob'], ticketId: 'ticket-1', workspaceSlug: 'acme' } },
    ]);
  });
});
