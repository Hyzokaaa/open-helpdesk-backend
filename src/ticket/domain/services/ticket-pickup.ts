import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { markResolved } from '../ticket-resolution';
import { ensureAssignmentFits } from '../ticket-assignment-rule';

const VALID_PICKUP_STATUSES = [TicketStatus.PENDING, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED];

interface PickupTicketProps {
  ticketId: string;
  workspaceId: string;
  userId: string;
  status?: TicketStatus;
}

export class PickupTicket {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: PickupTicketProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Ticket not found');

    if (ticket.status !== TicketStatus.OPEN) {
      throw new DomainValidationError('Only open tickets can be picked up');
    }

    const targetStatus = props.status ?? TicketStatus.PENDING;
    if (!VALID_PICKUP_STATUSES.includes(targetStatus)) {
      throw new DomainValidationError('Invalid pickup status');
    }

    // Whoever picks it up has it, so every pickup status fits the rule
    ensureAssignmentFits(targetStatus, props.userId);
    ticket.assigneeId = props.userId;
    ticket.status = targetStatus;
    // Resolved straight from the queue: who and when count, as for any resolution
    if (targetStatus === TicketStatus.RESOLVED) markResolved(ticket, props.userId);

    await this.repository.update(ticket);
    return ticket;
  }
}
