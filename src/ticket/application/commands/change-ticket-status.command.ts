import { Command } from '../../../shared/domain/command';
import { TicketStatus } from '../../domain/enums/ticket-status.enum';
import { ChangeTicketStatus } from '../../domain/services/ticket-change-status';

interface Props {
  ticketId: string;
  status: TicketStatus;
}

export interface ChangeStatusResponse {
  id: string;
  status: string;
  resolvedAt: Date | null;
}

export class ChangeTicketStatusCommand implements Command<Props, ChangeStatusResponse> {
  constructor(private readonly changeStatus: ChangeTicketStatus) {}

  async execute(props: Props): Promise<ChangeStatusResponse> {
    const ticket = await this.changeStatus.execute(props);

    return {
      id: ticket.getId(),
      status: ticket.status,
      resolvedAt: ticket.resolvedAt,
    };
  }
}
