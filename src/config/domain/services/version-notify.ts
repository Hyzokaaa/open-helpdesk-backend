import { User } from '../../../user/domain/entities/user';
import { DispatchNotifications, DispatchResult } from '../../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../../notification/domain/enums/notification-type.enum';
import { SystemNotificationSettings } from '../entities/system-notification-settings';

interface NotifyResult {
  dispatched: boolean;
  lastNotifiedVersion: string;
  emailRecipients: DispatchResult['emailRecipients'];
}

export class NotifyVersionUpdate {
  constructor(
    private readonly settings: SystemNotificationSettings,
    private readonly users: User[],
    private readonly dispatch: DispatchNotifications,
  ) {}

  async execute(latestVersion: string, releaseUrl: string): Promise<NotifyResult | null> {
    if (!this.settings.upgradeEnabled) return null;
    if (this.settings.lastNotifiedVersion === latestVersion) return null;

    const { emailRecipients } = await this.dispatch.execute({
      users: this.users,
      type: NotificationType.UPGRADE_AVAILABLE,
      title: `Open Helpdesk v${latestVersion} is available`,
      ticketId: null,
      workspaceSlug: '',
      inAppPrefKey: 'inAppUpgradeAvailable',
      emailPrefKey: 'emailUpgradeAvailable',
    });

    return {
      dispatched: true,
      lastNotifiedVersion: latestVersion,
      emailRecipients,
    };
  }
}
