import { IdGenerator } from '../../../shared/domain/id-generator';
import { User } from '../../../user/domain/entities/user';
import { Notification } from '../entities/notification';
import { NotificationPreference } from '../entities/notification-preference';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPreferenceRepository } from '../repositories/notification-preference.repository';

interface DispatchProps {
  users: User[];
  type: string;
  title: string;
  ticketId: string | null;
  workspaceSlug: string;
  inAppPrefKey: keyof NotificationPreference;
  emailPrefKey: keyof NotificationPreference;
}

export interface DispatchResult {
  emailRecipients: Map<string, string[]>;
}

export class DispatchNotifications {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly notificationRepository: NotificationRepository,
    private readonly preferenceRepository: NotificationPreferenceRepository,
  ) {}

  async execute(props: DispatchProps): Promise<DispatchResult> {
    if (props.users.length === 0) return { emailRecipients: new Map() };

    const userIds = props.users.map((u) => u.getId());
    const prefs = await this.preferenceRepository.findByUserIds(userIds);

    // In-app notifications
    for (const user of props.users) {
      if (this.shouldNotifyInApp(prefs.get(user.getId()), props.inAppPrefKey)) {
        await this.notificationRepository.create(
          new Notification({
            id: this.idGenerator.create(),
            userId: user.getId(),
            type: props.type,
            title: props.title,
            ticketId: props.ticketId,
            workspaceSlug: props.workspaceSlug,
            isRead: false,
          }),
        );
      }
    }

    // Group email recipients by language
    const emailRecipients = new Map<string, string[]>();
    for (const user of props.users) {
      if (this.shouldNotifyEmail(prefs.get(user.getId()), props.emailPrefKey)) {
        const lang = user.language || 'en';
        if (!emailRecipients.has(lang)) emailRecipients.set(lang, []);
        emailRecipients.get(lang)!.push(user.email);
      }
    }

    return { emailRecipients };
  }

  private shouldNotifyInApp(
    pref: NotificationPreference | undefined,
    key: keyof NotificationPreference,
  ): boolean {
    if (!pref) return true;
    return pref.inAppEnabled && pref[key] === true;
  }

  private shouldNotifyEmail(
    pref: NotificationPreference | undefined,
    key: keyof NotificationPreference,
  ): boolean {
    if (!pref) return true;
    return pref.emailEnabled && pref[key] === true;
  }
}
