import { Query } from '../../../shared/domain/query';
import { NotificationPreferenceRepository } from '../../domain/repositories/notification-preference.repository';

interface Props {
  userId: string;
}

export interface PreferencesResponse {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  emailTicketCreated: boolean;
  emailTicketAssigned: boolean;
  emailStatusChanged: boolean;
  emailCommentCreated: boolean;
  inAppTicketCreated: boolean;
  inAppTicketAssigned: boolean;
  inAppStatusChanged: boolean;
  inAppCommentCreated: boolean;
  bellUnreadOnly: boolean;
}

const DEFAULTS: PreferencesResponse = {
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
};

export class GetPreferencesQuery implements Query<Props, PreferencesResponse> {
  constructor(private readonly repository: NotificationPreferenceRepository) {}

  async execute(props: Props): Promise<PreferencesResponse> {
    const pref = await this.repository.findByUserId(props.userId);
    if (!pref) return DEFAULTS;

    return {
      emailEnabled: pref.emailEnabled,
      inAppEnabled: pref.inAppEnabled,
      emailTicketCreated: pref.emailTicketCreated,
      emailTicketAssigned: pref.emailTicketAssigned,
      emailStatusChanged: pref.emailStatusChanged,
      emailCommentCreated: pref.emailCommentCreated,
      inAppTicketCreated: pref.inAppTicketCreated,
      inAppTicketAssigned: pref.inAppTicketAssigned,
      inAppStatusChanged: pref.inAppStatusChanged,
      inAppCommentCreated: pref.inAppCommentCreated,
      bellUnreadOnly: pref.bellUnreadOnly,
    };
  }
}
