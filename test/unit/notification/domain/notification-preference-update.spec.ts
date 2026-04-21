import { UpdateNotificationPreference } from '../../../../src/notification/domain/services/notification-preference-update';
import { NotificationPreference } from '../../../../src/notification/domain/entities/notification-preference';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockNotificationPreferenceRepository } from '../../../mocks/mock-notification-preference.repository';

describe('UpdateNotificationPreference', () => {
  let service: UpdateNotificationPreference;
  let repository: MockNotificationPreferenceRepository;

  beforeEach(() => {
    repository = new MockNotificationPreferenceRepository();
    service = new UpdateNotificationPreference(new FakeIdGenerator(), repository);
  });

  it('should create preference with defaults when none exists', async () => {
    const pref = await service.execute({ userId: 'user-1', emailEnabled: false });

    expect(pref.userId).toBe('user-1');
    expect(pref.emailEnabled).toBe(false);
    expect(pref.inAppEnabled).toBe(true);
    expect(pref.emailTicketCreated).toBe(true);
  });

  it('should update existing preference partially', async () => {
    repository.seed(new NotificationPreference({
      id: 'pref-1', userId: 'user-1',
      emailEnabled: true, inAppEnabled: true,
      emailTicketCreated: true, emailTicketAssigned: true,
      emailStatusChanged: true, emailCommentCreated: true,
      inAppTicketCreated: true, inAppTicketAssigned: true,
      inAppStatusChanged: true, inAppCommentCreated: true,
      bellUnreadOnly: false,
    }));

    const pref = await service.execute({ userId: 'user-1', bellUnreadOnly: true, inAppEnabled: false });

    expect(pref.bellUnreadOnly).toBe(true);
    expect(pref.inAppEnabled).toBe(false);
    expect(pref.emailEnabled).toBe(true);
  });
});
