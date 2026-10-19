import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketRepository } from '../repositories/ticket.repository';
import { TicketPortalAccessRepository } from '../repositories/ticket-portal-access.repository';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';

interface Props {
  token: string;
  /** Who is signed in */
  userId: string;
}

/**
 * Where a portal link leads its owner once they have signed in, for when the portal is closed: the
 * ticket in the dashboard. Someone else's link, or one that no longer opens anything, is a 404.
 */
export class ResolveOwnTicketPortalAccess {
  constructor(
    private readonly accessRepository: TicketPortalAccessRepository,
    private readonly ticketRepository: TicketRepository,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async execute(props: Props): Promise<{ workspaceSlug: string; ticketId: string }> {
    const access = await this.accessRepository.findByToken(props.token);
    if (!access || access.userId !== props.userId) throw new EntityNotFoundError('Ticket not found');

    const ticket = await this.ticketRepository.findById(access.ticketId);
    const workspace = ticket ? await this.workspaceRepository.findById(ticket.workspaceId) : null;
    if (!ticket || !workspace) throw new EntityNotFoundError('Ticket not found');

    return { workspaceSlug: workspace.slug, ticketId: ticket.getId() };
  }
}
