import { Command } from '../../../shared/domain/command';
import { UpdateNotificationPreference } from '../../domain/services/notification-preference-update';

interface Props {
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

export interface UpdatePreferencesResponse {
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

export class UpdatePreferencesCommand implements Command<Props, UpdatePreferencesResponse> {
  constructor(
    private readonly updatePreference: UpdateNotificationPreference,
  ) {}

  async execute(props: Props): Promise<UpdatePreferencesResponse> {
    const pref = await this.updatePreference.execute(props);

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
