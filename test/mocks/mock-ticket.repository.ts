import { PaginatedResult } from '../../src/shared/domain/paginated-result';
import { Ticket } from '../../src/ticket/domain/entities/ticket';
import { TicketFilters, TicketRepository } from '../../src/ticket/domain/repositories/ticket.repository';

export class MockTicketRepository implements TicketRepository {
  private tickets: Ticket[] = [];

  async create(ticket: Ticket): Promise<void> {
    this.tickets.push(ticket);
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.tickets.find((t) => t.getId() === id) ?? null;
  }

  async findAll(
    workspaceId: string,
    _filters: TicketFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Ticket>> {
    const items = this.tickets.filter((t) => t.workspaceId === workspaceId);
    return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit };
  }

  async update(ticket: Ticket): Promise<void> {
    const index = this.tickets.findIndex((t) => t.getId() === ticket.getId());
    if (index >= 0) this.tickets[index] = ticket;
  }

  async softDelete(id: string): Promise<void> {
    this.tickets = this.tickets.filter((t) => t.getId() !== id);
  }

  getAll(): Ticket[] {
    return this.tickets;
  }
}
