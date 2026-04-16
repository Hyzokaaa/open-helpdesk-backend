import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Ticket } from '../entities/ticket';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.PENDING]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.RESOLVED,
    TicketStatus.PENDING,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
  [TicketStatus.CLOSED]: [],
};

interface ChangeTicketStatusProps {
  ticketId: string;
  status: TicketStatus;
}

export class ChangeTicketStatus {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: ChangeTicketStatusProps): Promise<Ticket> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const allowed = ALLOWED_TRANSITIONS[ticket.status];
    if (!allowed.includes(props.status)) {
      throw new BadRequestException(
        `Cannot transition from '${ticket.status}' to '${props.status}'`,
      );
    }

    ticket.status = props.status;

    if (props.status === TicketStatus.RESOLVED) {
      ticket.resolvedAt = new Date();
    } else if (ticket.resolvedAt && props.status !== TicketStatus.CLOSED) {
      ticket.resolvedAt = null;
    }

    await this.repository.update(ticket);
    return ticket;
  }
}
