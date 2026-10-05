import { Command } from '../../../shared/domain/command';
import { DomainValidationError } from '../../../shared/domain/errors';
import { ParticipantRole } from '../../domain/enums/participant-role.enum';
import { AddTicketParticipant } from '../../domain/services/ticket-add-participant';
import { EnsureTicketAccess } from '../../domain/services/ticket-ensure-access';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { UserRepository } from '../../../user/domain/repositories/user.repository';

interface Props {
  ticketId: string;
  workspaceId: string;
  /** Who is acting. */
  userId: string;
  /** Who is added. */
  targetUserId: string;
  role: ParticipantRole;
  isSystemAdmin: boolean;
}

export type AddTicketParticipantResponse =
  | { added: true }
  | { added: false; reason: string };

/**
 * Anyone who can see a ticket may follow it themselves. Adding someone else needs full
 * access plus `ticket.participants.manage`, and that someone must belong to the workspace,
 * since following grants them read access to the ticket.
 */
export class AddTicketParticipantCommand implements Command<Props, AddTicketParticipantResponse> {
  constructor(
    private readonly addParticipant: AddTicketParticipant,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly userRepository?: UserRepository,
  ) {}

  async execute(props: Props): Promise<AddTicketParticipantResponse> {
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

    const member = await this.memberRepository.findByWorkspaceAndUser(props.workspaceId, props.targetUserId);
    if (!member) throw new DomainValidationError('User is not a member of this workspace');

    const participant = await this.addParticipant.execute({
      ticketId: props.ticketId,
      userId: props.targetUserId,
      role: props.role,
    });
    if (!participant) return { added: false, reason: 'already a participant' };

    await this.createAuditLog.execute({
      action: AuditAction.PARTICIPANT_ADDED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { participantUserId: props.targetUserId, target: await this.targetLabel(props.targetUserId), role: props.role },
    });

    return { added: true };
  }

  /** Who was added or removed, by name and email, so the audit entry reads without a lookup. */
  private async targetLabel(userId: string): Promise<string | undefined> {
    const user = this.userRepository ? await this.userRepository.findById(userId) : null;
    return user ? `${user.firstName} ${user.lastName} (${user.email})` : undefined;
  }
}
