import { Command } from '../../../shared/domain/command';
import { AssignTicket } from '../../domain/services/ticket-assign';

interface Props {
  ticketId: string;
  assigneeId: string | null;
}

export interface AssignTicketResponse {
  id: string;
  assigneeId: string | null;
}

export class AssignTicketCommand implements Command<Props, AssignTicketResponse> {
  constructor(private readonly assignTicket: AssignTicket) {}

  async execute(props: Props): Promise<AssignTicketResponse> {
    const ticket = await this.assignTicket.execute(props);

    return {
      id: ticket.getId(),
      assigneeId: ticket.assigneeId,
    };
  }
}
