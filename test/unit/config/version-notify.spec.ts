import { NotifyVersionUpdate } from '../../../src/config/domain/services/version-notify';
import { SystemNotificationSettings } from '../../../src/config/domain/entities/system-notification-settings';
import { DispatchNotifications } from '../../../src/notification/domain/services/notification-dispatch';
import { Notification } from '../../../src/notification/domain/entities/notification';
import { User } from '../../../src/user/domain/entities/user';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockNotificationPreferenceRepository } from '../../mocks/mock-notification-preference.repository';

const admin = new User({
  id: 'admin', email: 'admin@x.com', password: 'x', firstName: 'Ana', lastName: 'B',
  isActive: true, isSystemAdmin: true, isEmailVerified: true, language: 'es', theme: 'system',
});

describe('Telling the system admins about a new version', () => {
  let notifications: Notification[];
  const notify = (inApp: boolean, enabled = true) => {
    notifications = [];
    const settings = new SystemNotificationSettings({
      id: 's', upgradeEnabled: enabled, upgradeEmail: true, upgradeInApp: inApp, lastNotifiedVersion: null,
    });
    const dispatch = new DispatchNotifications(
      new FakeIdGenerator(),
      { create: async (n: Notification) => { notifications.push(n); } } as any,
      new MockNotificationPreferenceRepository(),
    );
    return new NotifyVersionUpdate(settings, [admin], dispatch).execute('1.39.0', 'https://example.test/release');
  };

  it('notifies in the app and lists the email recipients', async () => {
    const result = await notify(true);
    expect(notifications).toHaveLength(1);
    expect(result?.emailRecipients.get('es')).toEqual(['admin@x.com']);
  });

  it('does not notify in the app when "In the app" is off, but still lists the email recipients', async () => {
    const result = await notify(false);
    expect(notifications).toHaveLength(0);
    expect(result?.dispatched).toBe(true);
    expect(result?.emailRecipients.get('es')).toEqual(['admin@x.com']);
  });

  it('does nothing while the notice is off', async () => {
    expect(await notify(true, false)).toBeNull();
    expect(notifications).toHaveLength(0);
  });
});
