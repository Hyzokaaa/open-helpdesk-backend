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

const DEFAULTS: PreferencesResponse = {
  emailEnabled: true,
  inAppEnabled: true,
  emailTicketCreated: true,
  emailTicketAssigned: true,
  emailStatusChanged: true,
  emailCommentCreated: true,
  emailCsatSurvey: true,
  emailTransferRequest: true,
  inAppTicketCreated: true,
  inAppTicketAssigned: true,
  inAppStatusChanged: true,
  inAppTicketUnassigned: true,
  inAppCommentCreated: true,
  inAppTransferRequest: true,
  emailUpgradeAvailable: true,
  inAppUpgradeAvailable: true,
  inAppInvitationExpired: true,
  inAppUnattendedReply: true,
  emailUnattendedReply: true,
  inAppMentioned: true,
  emailMentioned: true,
  matrixEnabled: false,
  matrixTicketCreated: true,
  matrixTicketAssigned: true,
  matrixStatusChanged: true,
  matrixTicketUnassigned: true,
  matrixCommentCreated: true,
  matrixTransferRequest: true,
  matrixUnattendedReply: true,
  matrixMentioned: true,
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
