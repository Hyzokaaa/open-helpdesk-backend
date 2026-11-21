import { DispatchNotifications } from '../../../src/notification/domain/services/notification-dispatch';
import { NotificationPreference } from '../../../src/notification/domain/entities/notification-preference';
import { Notification } from '../../../src/notification/domain/entities/notification';
import { MATRIX_PERSONAL_NOTICE_EVENT } from '../../../src/notification/domain/matrix-personal-notice';
import { User } from '../../../src/user/domain/entities/user';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { FakeEventPublisher } from '../../mocks/fake-event-publisher';
import { MockNotificationPreferenceRepository } from '../../mocks/mock-notification-preference.repository';

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

describe('Dispatching a notification on Matrix too', () => {
  let preferences: MockNotificationPreferenceRepository;
  let events: FakeEventPublisher;
  let dispatch: DispatchNotifications;

  const assigned = (users: User[], withEvents = true) => (withEvents ? dispatch : new DispatchNotifications(new FakeIdGenerator(), { create: async () => undefined } as never, preferences)).execute({
    users,
    type: 'ticket-assigned',
    title: 'Assigned: Printer',
    ticketId: 'ticket-1',
    workspaceSlug: 'acme',
    inAppPrefKey: 'inAppTicketAssigned',
    emailPrefKey: 'emailTicketAssigned',
    matrix: { prefKey: 'matrixTicketAssigned', notice: { kind: 'assigned' } },
  });

  beforeEach(() => {
    preferences = new MockNotificationPreferenceRepository();
    events = new FakeEventPublisher();
    const created: Notification[] = [];
    dispatch = new DispatchNotifications(new FakeIdGenerator(), { create: async (n: Notification) => { created.push(n); } } as never, preferences, events);
  });

  it('is off by default: no saved preferences, or Matrix never turned on', async () => {
    preferences.seed(prefs('ana'));
    await assigned([user('ana'), user('bob')]);
    expect(events.events).toEqual([]);
  });

  it('goes to whoever turned Matrix on and wants that event there', async () => {
    preferences.seed(prefs('ana', { matrixEnabled: true }));
    preferences.seed(prefs('bob', { matrixEnabled: true, matrixTicketAssigned: false }));
    preferences.seed(prefs('eve', { matrixEnabled: false, matrixTicketAssigned: true }));
    await assigned([user('ana'), user('bob'), user('eve')]);

    expect(events.events).toEqual([{
      event: MATRIX_PERSONAL_NOTICE_EVENT,
      data: { kind: 'assigned', userIds: ['ana'], ticketId: 'ticket-1', workspaceSlug: 'acme' },
    }]);
  });

  it('does not depend on the email or in-app channels being on', async () => {
    preferences.seed(prefs('ana', { matrixEnabled: true, emailEnabled: false, inAppEnabled: false }));
    const { emailRecipients } = await assigned([user('ana')]);
    expect(emailRecipients.size).toBe(0);
    expect(events.events).toHaveLength(1);
  });

  it('sends nothing on Matrix without an event publisher, as before', async () => {
    preferences.seed(prefs('ana', { matrixEnabled: true }));
    await assigned([user('ana')], false);
    expect(events.events).toEqual([]);
  });
});
