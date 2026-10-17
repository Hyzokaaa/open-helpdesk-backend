import { TicketRepository } from '../repositories/ticket.repository';
import { TicketPortalAccessRepository } from '../repositories/ticket-portal-access.repository';

interface Props {
  ticketId: string;
  userId: string;
}

/**
 * Someone no longer takes part in the ticket (removed as a follower): their portal link stops
 * opening it. The reporter's link stays, since the ticket is theirs.
 */
export class RevokeTicketPortalAccess {
  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly accessRepository: TicketPortalAccessRepository,
  ) {}

  async execute(props: Props): Promise<void> {
    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (ticket?.reporterId === props.userId) return;
    await this.accessRepository.remove(props.ticketId, props.userId);
  }
}
