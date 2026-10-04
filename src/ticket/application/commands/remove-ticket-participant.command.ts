import { Command } from '../../../shared/domain/command';
import { TicketParticipantRepository } from '../../domain/repositories/ticket-participant.repository';
import { EnsureTicketAccess } from '../../domain/services/ticket-ensure-access';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  ticketId: string;
  workspaceId: string;
  /** Who is acting. */
  userId: string;
  /** Who is removed. */
  targetUserId: string;
  isSystemAdmin: boolean;
}

export interface RemoveTicketParticipantResponse {
  removed: true;
}

/** Anyone may unfollow a ticket they can see; removing someone else needs `ticket.participants.manage`. */
export class RemoveTicketParticipantCommand implements Command<Props, RemoveTicketParticipantResponse> {
  constructor(
    private readonly participantRepository: TicketParticipantRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<RemoveTicketParticipantResponse> {
    const access = { ticketId: props.ticketId, workspaceId: props.workspaceId, userId: props.userId, isSystemAdmin: props.isSystemAdmin };

    if (props.targetUserId === props.userId) {
      await this.ensureTicketAccess.execute(access);
    } else {
      await this.ensureTicketAccess.ensureFull(access);
      await this.ensurePermission.execute({
        workspaceId: props.workspaceId,
        userId: props.userId,
        permission: PERMISSIONS.TICKET_PARTICIPANTS_MANAGE,
        isSystemAdmin: props.isSystemAdmin,
      });
    }

    await this.participantRepository.remove(props.ticketId, props.targetUserId);

    await this.createAuditLog.execute({
      action: AuditAction.PARTICIPANT_REMOVED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { participantUserId: props.targetUserId },
    });

    return { removed: true };
  }
}
