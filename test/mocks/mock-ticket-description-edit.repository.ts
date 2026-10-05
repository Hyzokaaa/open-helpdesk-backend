import { TicketDescriptionEdit } from '../../src/ticket/domain/entities/ticket-description-edit';
import { TicketDescriptionEditRepository } from '../../src/ticket/domain/repositories/ticket-description-edit.repository';

export class MockTicketDescriptionEditRepository implements TicketDescriptionEditRepository {
  private edits: TicketDescriptionEdit[] = [];

  async create(edit: TicketDescriptionEdit): Promise<void> {
    this.edits.push(edit);
  }

  async findByTicketId(ticketId: string): Promise<TicketDescriptionEdit[]> {
    return this.edits.filter((e) => e.ticketId === ticketId);
  }

  seed(edit: TicketDescriptionEdit): void {
    this.edits.push(edit);
  }
}
