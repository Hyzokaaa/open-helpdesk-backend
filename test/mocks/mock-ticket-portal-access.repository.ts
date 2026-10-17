import { TicketPortalAccess } from '../../src/ticket/domain/entities/ticket-portal-access';
import { TicketPortalAccessRepository } from '../../src/ticket/domain/repositories/ticket-portal-access.repository';

export class MockTicketPortalAccessRepository implements TicketPortalAccessRepository {
  private accesses: TicketPortalAccess[] = [];

  /** Ticket id → workspace id, for removeByUserInWorkspace. */
  constructor(private readonly ticketWorkspaces: Map<string, string> = new Map()) {}

  async create(access: TicketPortalAccess): Promise<void> {
    if (this.accesses.some((a) => a.token === access.token || (a.ticketId === access.ticketId && a.userId === access.userId))) {
      throw new Error('duplicate portal access');
    }
    this.accesses.push(access);
  }

  async findByToken(token: string): Promise<TicketPortalAccess | null> {
    return this.accesses.find((a) => a.token === token) ?? null;
  }

  async findByTicketAndUser(ticketId: string, userId: string): Promise<TicketPortalAccess | null> {
    return this.accesses.find((a) => a.ticketId === ticketId && a.userId === userId) ?? null;
  }

  async findByTicketIds(ticketIds: string[]): Promise<TicketPortalAccess[]> {
    return this.accesses.filter((a) => ticketIds.includes(a.ticketId));
  }

  async remove(ticketId: string, userId: string): Promise<void> {
    this.accesses = this.accesses.filter((a) => !(a.ticketId === ticketId && a.userId === userId));
  }

  async removeByUserInWorkspace(userId: string, workspaceId: string): Promise<void> {
    this.accesses = this.accesses.filter(
      (a) => !(a.userId === userId && this.ticketWorkspaces.get(a.ticketId) === workspaceId),
    );
  }

  all(): TicketPortalAccess[] {
    return this.accesses;
  }
}
