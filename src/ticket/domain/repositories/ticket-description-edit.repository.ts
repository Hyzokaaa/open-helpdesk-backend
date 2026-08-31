import { TicketDescriptionEdit } from '../entities/ticket-description-edit';

export interface TicketDescriptionEditRepository {
  create(edit: TicketDescriptionEdit): Promise<void>;
  findByTicketId(ticketId: string): Promise<TicketDescriptionEdit[]>;
}
