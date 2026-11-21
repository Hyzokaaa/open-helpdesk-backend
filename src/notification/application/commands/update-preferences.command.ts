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
  emailCsatSurvey?: boolean;
  emailTransferRequest?: boolean;
  inAppTicketCreated?: boolean;
  inAppTicketAssigned?: boolean;
  inAppStatusChanged?: boolean;
  inAppTicketUnassigned?: boolean;
  inAppCommentCreated?: boolean;
  inAppTransferRequest?: boolean;
  emailUpgradeAvailable?: boolean;
  inAppUpgradeAvailable?: boolean;
  inAppInvitationExpired?: boolean;
  inAppUnattendedReply?: boolean;
  emailUnattendedReply?: boolean;
  inAppMentioned?: boolean;
  emailMentioned?: boolean;
  matrixEnabled?: boolean;
  matrixTicketCreated?: boolean;
  matrixTicketAssigned?: boolean;
  matrixStatusChanged?: boolean;
  matrixTicketUnassigned?: boolean;
  matrixCommentCreated?: boolean;
  matrixTransferRequest?: boolean;
  matrixUnattendedReply?: boolean;
  matrixMentioned?: boolean;
  bellUnreadOnly?: boolean;
}

export interface UpdatePreferencesResponse {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  emailTicketCreated: boolean;
  emailTicketAssigned: boolean;
  emailStatusChanged: boolean;
  emailCommentCreated: boolean;
  emailCsatSurvey: boolean;
  emailTransferRequest: boolean;
  inAppTicketCreated: boolean;
  inAppTicketAssigned: boolean;
  inAppStatusChanged: boolean;
  inAppTicketUnassigned: boolean;
  inAppCommentCreated: boolean;
  inAppTransferRequest: boolean;
  emailUpgradeAvailable: boolean;
  inAppUpgradeAvailable: boolean;
  inAppInvitationExpired: boolean;
  inAppUnattendedReply: boolean;
  emailUnattendedReply: boolean;
  inAppMentioned: boolean;
  emailMentioned: boolean;
  matrixEnabled: boolean;
  matrixTicketCreated: boolean;
  matrixTicketAssigned: boolean;
  matrixStatusChanged: boolean;
  matrixTicketUnassigned: boolean;
  matrixCommentCreated: boolean;
  matrixTransferRequest: boolean;
  matrixUnattendedReply: boolean;
  matrixMentioned: boolean;
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
      emailCsatSurvey: pref.emailCsatSurvey,
      emailTransferRequest: pref.emailTransferRequest,
      inAppTicketCreated: pref.inAppTicketCreated,
      inAppTicketAssigned: pref.inAppTicketAssigned,
      inAppStatusChanged: pref.inAppStatusChanged,
      inAppTicketUnassigned: pref.inAppTicketUnassigned,
      inAppCommentCreated: pref.inAppCommentCreated,
      inAppTransferRequest: pref.inAppTransferRequest,
      emailUpgradeAvailable: pref.emailUpgradeAvailable,
      inAppUpgradeAvailable: pref.inAppUpgradeAvailable,
      inAppInvitationExpired: pref.inAppInvitationExpired,
      inAppUnattendedReply: pref.inAppUnattendedReply,
      emailUnattendedReply: pref.emailUnattendedReply,
      inAppMentioned: pref.inAppMentioned,
      emailMentioned: pref.emailMentioned,
      matrixEnabled: pref.matrixEnabled,
      matrixTicketCreated: pref.matrixTicketCreated,
      matrixTicketAssigned: pref.matrixTicketAssigned,
      matrixStatusChanged: pref.matrixStatusChanged,
      matrixTicketUnassigned: pref.matrixTicketUnassigned,
      matrixCommentCreated: pref.matrixCommentCreated,
      matrixTransferRequest: pref.matrixTransferRequest,
      matrixUnattendedReply: pref.matrixUnattendedReply,
      matrixMentioned: pref.matrixMentioned,
      bellUnreadOnly: pref.bellUnreadOnly,
    };
  }
}
