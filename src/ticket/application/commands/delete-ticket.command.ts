import { Command } from '../../../shared/domain/command';
import { DeleteTicket } from '../../domain/services/ticket-delete';

interface Props {
  ticketId: string;
}

export class DeleteTicketCommand implements Command<Props, void> {
  constructor(private readonly deleteTicket: DeleteTicket) {}

  async execute(props: Props): Promise<void> {
    await this.deleteTicket.execute({ ticketId: props.ticketId });
  }
}
