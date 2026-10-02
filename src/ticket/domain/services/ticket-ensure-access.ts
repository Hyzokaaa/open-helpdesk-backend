import { AccessDeniedError, EntityNotFoundError } from '../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { TicketParticipantRepository } from '../repositories/ticket-participant.repository';

export type TicketAccessLevel = 'full' | 'readonly';

interface Props {
  ticketId: string;
  userId: string;
  workspaceId: string;
  isSystemAdmin: boolean;
}

export class EnsureTicketAccess {
  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly participantRepository: TicketParticipantRepository,
  ) {}

  /**
   * Membership is checked before the ticket is loaded, and a ticket missing or outside
   * `workspaceId` is not found for everyone, so neither reveals that a ticket exists.
   */
  async execute(props: Props): Promise<TicketAccessLevel> {
    const ctx = props.isSystemAdmin
      ? null
      : await this.ensurePermission.execute({
          workspaceId: props.workspaceId,
          userId: props.userId,
          anyOf: [PERMISSIONS.TICKET_VIEW, PERMISSIONS.TICKET_VIEW_OWN],
          isSystemAdmin: false,
        });

    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Ticket not found');
    }

    if (!ctx || hasPermission(ctx.role, PERMISSIONS.TICKET_VIEW)) return 'full';

    const isAgent = ctx.role === WorkspaceRole.AGENT;
    const hasDirectAccess = isAgent
      ? (ticket.assigneeId === props.userId || ticket.status === 'open')
      : ticket.reporterId === props.userId;

    if (hasDirectAccess) return 'full';

    const isParticipant = await this.participantRepository.exists(props.ticketId, props.userId);
    if (isParticipant) return 'readonly';

    throw new AccessDeniedError('You do not have access to this ticket');
  }

  async ensureFull(props: Props): Promise<void> {
    const level = await this.execute(props);
    if (level === 'readonly') {
      throw new AccessDeniedError('Read-only access to this ticket');
    }
  }
}
