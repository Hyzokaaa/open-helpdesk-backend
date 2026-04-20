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
  inAppTicketCreated: boolean;
  inAppTicketAssigned: boolean;
  inAppStatusChanged: boolean;
  inAppCommentCreated: boolean;
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
  inAppTicketCreated: boolean;
  inAppTicketAssigned: boolean;
  inAppStatusChanged: boolean;
  inAppCommentCreated: boolean;
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
    this.inAppTicketCreated = props.inAppTicketCreated;
    this.inAppTicketAssigned = props.inAppTicketAssigned;
    this.inAppStatusChanged = props.inAppStatusChanged;
    this.inAppCommentCreated = props.inAppCommentCreated;
    this.bellUnreadOnly = props.bellUnreadOnly;
  }

  getId(): string {
    return this.id.get();
  }
}
