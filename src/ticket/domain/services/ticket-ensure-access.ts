import { AccessDeniedError, EntityNotFoundError } from '../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { TicketParticipantRepository } from '../repositories/ticket-participant.repository';
import { ParticipantRole } from '../enums/participant-role.enum';

/**
 * `full` manages the ticket (status, assignment, fields). `readonly` cannot, but still takes part
 * in the conversation: see `ensureCanContribute`.
 */
export type TicketAccessLevel = 'full' | 'readonly';

/**
 * The one place a participant's role becomes access. Collaborators are not assigned anywhere yet,
 * so they get what followers get until it is decided what more they may do.
 */
const PARTICIPANT_ACCESS: Record<ParticipantRole, TicketAccessLevel> = {
  [ParticipantRole.FOLLOWER]: 'readonly',
  [ParticipantRole.COLLABORATOR]: 'readonly',
};

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

    const participants = await this.participantRepository.findByTicketId(props.ticketId);
    const participant = participants.find((p) => p.userId === props.userId);
    if (participant) return PARTICIPANT_ACCESS[participant.role];

    throw new AccessDeniedError('You do not have access to this ticket');
  }

  /** Commenting and adding files: open to everyone who can see the ticket, participants included. */
  async ensureCanContribute(props: Props): Promise<TicketAccessLevel> {
    return this.execute(props);
  }

  async ensureFull(props: Props): Promise<void> {
    const level = await this.execute(props);
    if (level === 'readonly') {
      throw new AccessDeniedError('Read-only access to this ticket');
    }
  }
}
