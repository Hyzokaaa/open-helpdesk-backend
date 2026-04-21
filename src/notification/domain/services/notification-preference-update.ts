import { IdGenerator } from '../../../shared/domain/id-generator';
import { NotificationPreference } from '../entities/notification-preference';
import { NotificationPreferenceRepository } from '../repositories/notification-preference.repository';

interface UpdatePreferenceProps {
  userId: string;
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  emailTicketCreated?: boolean;
  emailTicketAssigned?: boolean;
  emailStatusChanged?: boolean;
  emailCommentCreated?: boolean;
  inAppTicketCreated?: boolean;
  inAppTicketAssigned?: boolean;
  inAppStatusChanged?: boolean;
  inAppCommentCreated?: boolean;
  bellUnreadOnly?: boolean;
}

export class UpdateNotificationPreference {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: NotificationPreferenceRepository,
  ) {}

  async execute(props: UpdatePreferenceProps): Promise<NotificationPreference> {
    let pref = await this.repository.findByUserId(props.userId);

    if (!pref) {
      pref = new NotificationPreference({
        id: this.idGenerator.create(),
        userId: props.userId,
        emailEnabled: true,
        inAppEnabled: true,
        emailTicketCreated: true,
        emailTicketAssigned: true,
        emailStatusChanged: true,
        emailCommentCreated: true,
        inAppTicketCreated: true,
        inAppTicketAssigned: true,
        inAppStatusChanged: true,
        inAppCommentCreated: true,
        bellUnreadOnly: false,
      });
    }

    if (props.emailEnabled !== undefined) pref.emailEnabled = props.emailEnabled;
    if (props.inAppEnabled !== undefined) pref.inAppEnabled = props.inAppEnabled;
    if (props.emailTicketCreated !== undefined) pref.emailTicketCreated = props.emailTicketCreated;
    if (props.emailTicketAssigned !== undefined) pref.emailTicketAssigned = props.emailTicketAssigned;
    if (props.emailStatusChanged !== undefined) pref.emailStatusChanged = props.emailStatusChanged;
    if (props.emailCommentCreated !== undefined) pref.emailCommentCreated = props.emailCommentCreated;
    if (props.inAppTicketCreated !== undefined) pref.inAppTicketCreated = props.inAppTicketCreated;
    if (props.inAppTicketAssigned !== undefined) pref.inAppTicketAssigned = props.inAppTicketAssigned;
    if (props.inAppStatusChanged !== undefined) pref.inAppStatusChanged = props.inAppStatusChanged;
    if (props.inAppCommentCreated !== undefined) pref.inAppCommentCreated = props.inAppCommentCreated;
    if (props.bellUnreadOnly !== undefined) pref.bellUnreadOnly = props.bellUnreadOnly;

    await this.repository.upsert(pref);
    return pref;
  }
}
