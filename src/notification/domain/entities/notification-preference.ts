import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  userId: string;
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
  bellUnreadOnly: boolean;
}

export class NotificationPreference {
  readonly id: Id;
  userId: string;
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

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.userId = props.userId;
    this.emailEnabled = props.emailEnabled;
    this.inAppEnabled = props.inAppEnabled;
    this.emailTicketCreated = props.emailTicketCreated;
    this.emailTicketAssigned = props.emailTicketAssigned;
    this.emailStatusChanged = props.emailStatusChanged;
    this.emailCommentCreated = props.emailCommentCreated;
    this.emailCsatSurvey = props.emailCsatSurvey;
    this.emailTransferRequest = props.emailTransferRequest;
    this.inAppTicketCreated = props.inAppTicketCreated;
    this.inAppTicketAssigned = props.inAppTicketAssigned;
    this.inAppStatusChanged = props.inAppStatusChanged;
    this.inAppTicketUnassigned = props.inAppTicketUnassigned;
    this.inAppCommentCreated = props.inAppCommentCreated;
    this.inAppTransferRequest = props.inAppTransferRequest;
    this.emailUpgradeAvailable = props.emailUpgradeAvailable;
    this.inAppUpgradeAvailable = props.inAppUpgradeAvailable;
    this.inAppInvitationExpired = props.inAppInvitationExpired ?? true;
    this.inAppUnattendedReply = props.inAppUnattendedReply ?? true;
    this.emailUnattendedReply = props.emailUnattendedReply ?? true;
    this.inAppMentioned = props.inAppMentioned ?? true;
    this.emailMentioned = props.emailMentioned ?? true;
    this.matrixEnabled = props.matrixEnabled ?? false;
    this.matrixTicketCreated = props.matrixTicketCreated ?? true;
    this.matrixTicketAssigned = props.matrixTicketAssigned ?? true;
    this.matrixStatusChanged = props.matrixStatusChanged ?? true;
    this.matrixTicketUnassigned = props.matrixTicketUnassigned ?? true;
    this.matrixCommentCreated = props.matrixCommentCreated ?? true;
    this.matrixTransferRequest = props.matrixTransferRequest ?? true;
    this.matrixUnattendedReply = props.matrixUnattendedReply ?? true;
    this.matrixMentioned = props.matrixMentioned ?? true;
    this.bellUnreadOnly = props.bellUnreadOnly;
  }

  getId(): string {
    return this.id.get();
  }
}
