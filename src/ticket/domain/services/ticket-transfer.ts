import { AccessDeniedError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';

interface TransferTicketProps {
  ticketId: string;
  fromUserId: string;
  toUserId: string;
}

export class TransferTicket {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: TransferTicketProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    const isAssignee = ticket.assigneeId === props.fromUserId;
    const isCreator = ticket.reporterId === props.fromUserId;

    if (!isAssignee && !isCreator) {
      throw new AccessDeniedError('You can only transfer tickets assigned to you or created by you');
    }

    ticket.assigneeId = props.toUserId;

    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.PENDING;
    }

    await this.repository.update(ticket);
    return ticket;
  }
}
