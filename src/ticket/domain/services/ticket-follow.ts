import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { ParticipantRole } from '../enums/participant-role.enum';
import { AddTicketParticipant } from './ticket-add-participant';

/** Why someone started following a ticket without anyone adding them by hand. */
export type FollowReason = 'comment' | 'mention' | 'transfer-request';

interface FollowTicketProps {
  ticketId: string;
  workspaceId: string;
  /** Who starts following. */
  userId: string;
  /** Who caused it: the author of the comment or the mention, the agent asking for the transfer. */
  actorId: string;
  reason: FollowReason;
  source: string;
}

/**
 * Makes someone a follower as a side effect of another action, and leaves it in the audit log,
 * so the ticket's story tells why they receive its emails. Following twice does nothing.
 */
export class FollowTicket {
  constructor(
    private readonly addParticipant: AddTicketParticipant,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(props: FollowTicketProps): Promise<boolean> {
    const participant = await this.addParticipant.execute({
      ticketId: props.ticketId,
      userId: props.userId,
      role: ParticipantRole.FOLLOWER,
    });
    if (!participant) return false;

    const user = await this.userRepository.findById(props.userId);
    await this.createAuditLog.execute({
      action: AuditAction.PARTICIPANT_ADDED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: props.source,
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.actorId,
      workspaceId: props.workspaceId,
      metadata: {
        participantUserId: props.userId,
        target: user ? `${user.firstName} ${user.lastName} (${user.email})` : undefined,
        role: ParticipantRole.FOLLOWER,
        reason: props.reason,
      },
    });
    return true;
  }
}
