import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  ticketId: string;
  userId: string;
  token: string;
}

/**
 * A person's link to a ticket in the portal: whoever holds the token reads the ticket and
 * comments on it as that person, without signing in, so the token is a secret.
 */
export class TicketPortalAccess {
  readonly id: Id;
  ticketId: string;
  userId: string;
  token: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.ticketId = props.ticketId;
    this.userId = props.userId;
    this.token = props.token;
  }

  getId(): string {
    return this.id.get();
  }
}
