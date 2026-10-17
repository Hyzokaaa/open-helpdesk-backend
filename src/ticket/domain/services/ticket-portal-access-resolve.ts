import { User } from '../../../user/domain/entities/user';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { Workspace } from '../../../workspace/domain/entities/workspace';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { Ticket } from '../entities/ticket';
import { TicketRepository } from '../repositories/ticket.repository';
import { TicketPortalAccessRepository } from '../repositories/ticket-portal-access.repository';

export interface ResolvedPortalAccess {
  ticket: Ticket;
  workspace: Workspace;
  /** Who the link belongs to: they read the ticket and comment on it in the portal. */
  user: User;
}

/**
 * Who opens a ticket through a portal link, or null when the link no longer opens anything:
 * unknown token, ticket or workspace deleted, or its owner deactivated (a deactivated person
 * loses the portal as they lose the dashboard).
 */
export class ResolveTicketPortalAccess {
  constructor(
    private readonly accessRepository: TicketPortalAccessRepository,
    private readonly ticketRepository: TicketRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(token: string): Promise<ResolvedPortalAccess | null> {
    const access = await this.accessRepository.findByToken(token);
    if (!access) return null;

    const ticket = await this.ticketRepository.findById(access.ticketId);
    if (!ticket) return null;

    const [workspace, user] = await Promise.all([
      this.workspaceRepository.findById(ticket.workspaceId),
      this.userRepository.findById(access.userId),
    ]);
    if (!workspace || !user || !user.isActive) return null;

    return { ticket, workspace, user };
  }
}
