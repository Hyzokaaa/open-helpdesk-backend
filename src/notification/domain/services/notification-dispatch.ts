import { IdGenerator } from '../../../shared/domain/id-generator';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { User } from '../../../user/domain/entities/user';
import { Notification } from '../entities/notification';
import { NotificationPreference } from '../entities/notification-preference';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPreferenceRepository } from '../repositories/notification-preference.repository';
import { MATRIX_PERSONAL_NOTICE_EVENT, MatrixPersonalNotice, MatrixPersonalNoticeEvent } from '../matrix-personal-notice';

interface DispatchProps {
  users: User[];
  type: string;
  title: string;
  ticketId: string | null;
  workspaceSlug: string;
  inAppPrefKey: keyof NotificationPreference;
  /** Omit for in-app-only notifications. */
  emailPrefKey?: keyof NotificationPreference;
  /** False to only work out the email recipients, without notifying in the app. */
  inApp?: boolean;
  /** Also on Matrix, to whoever asks for it there; needs the event publisher. */
  matrix?: { prefKey: keyof NotificationPreference; notice: MatrixPersonalNotice };
  /** Users already told on a channel by another notice of the same occurrence: never twice there. */
  skip?: NotifiedChannels;
}

/** The user IDs told on each channel. */
export interface NotifiedChannels {
  inApp: Set<string>;
  email: Set<string>;
  matrix: Set<string>;
}

export interface DispatchResult {
  emailRecipients: Map<string, string[]>;
  notified: NotifiedChannels;
}

export class DispatchNotifications {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly notificationRepository: NotificationRepository,
    private readonly preferenceRepository: NotificationPreferenceRepository,
    /** Where the Matrix notices go (the Matrix module listens); without it there are none. */
    private readonly events: EventPublisher | null = null,
  ) {}

  async execute(props: DispatchProps): Promise<DispatchResult> {
    const notified: NotifiedChannels = { inApp: new Set(), email: new Set(), matrix: new Set() };
    if (props.users.length === 0) return { emailRecipients: new Map(), notified };

    const userIds = props.users.map((u) => u.getId());
    const prefs = await this.preferenceRepository.findByUserIds(userIds);
    const skipped = (channel: keyof NotifiedChannels, user: User) => !!props.skip?.[channel].has(user.getId());

    // In-app notifications
    for (const user of props.inApp === false ? [] : props.users) {
      if (skipped('inApp', user)) continue;
      if (this.shouldNotifyInApp(prefs.get(user.getId()), props.inAppPrefKey)) {
        notified.inApp.add(user.getId());
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

    for (const userId of this.notifyOnMatrix(props, prefs)) notified.matrix.add(userId);

    // Group email recipients by language
    const emailRecipients = new Map<string, string[]>();
    const emailPrefKey = props.emailPrefKey;
    if (!emailPrefKey) return { emailRecipients, notified };
    for (const user of props.users) {
      if (skipped('email', user)) continue;
      if (this.shouldNotifyEmail(prefs.get(user.getId()), emailPrefKey)) {
        notified.email.add(user.getId());
        const lang = user.language || 'en';
        if (!emailRecipients.has(lang)) emailRecipients.set(lang, []);
        emailRecipients.get(lang)!.push(user.email);
      }
    }

    return { emailRecipients, notified };
  }

  /** Off unless the user turned Matrix on: it needs a verified Matrix account first. Returns whom it asked for. */
  private notifyOnMatrix(props: DispatchProps, prefs: Map<string, NotificationPreference>): string[] {
    if (!props.matrix || !this.events || !props.ticketId) return [];
    const key = props.matrix.prefKey;
    const userIds = props.users
      .filter((user) => {
        if (props.skip?.matrix.has(user.getId())) return false;
        const pref = prefs.get(user.getId());
        return !!pref && pref.matrixEnabled && pref[key] === true;
      })
      .map((user) => user.getId());
    if (userIds.length === 0) return [];
    const event: MatrixPersonalNoticeEvent = { ...props.matrix.notice, userIds: [...new Set(userIds)], ticketId: props.ticketId, workspaceSlug: props.workspaceSlug };
    this.events.emit(MATRIX_PERSONAL_NOTICE_EVENT, event);
    return event.userIds;
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
