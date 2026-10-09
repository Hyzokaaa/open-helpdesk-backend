import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { DispatchNotifications } from '../../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../../notification/domain/enums/notification-type.enum';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  now: Date;
  /** How many to handle in one run, so a backlog spreads over several runs */
  limit: number;
}

/**
 * Tells each inviter, in the app, that an invitation they sent has expired, so they can resend it
 * instead of waiting for someone who can no longer get in. Each invitation is marked first, so it
 * is told once even if the notice itself fails or two instances run at the same time.
 */
export class NotifyExpiredInvitations {
  constructor(
    private readonly invitationRepository: WorkspaceInvitationRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
    private readonly dispatch: DispatchNotifications,
    private readonly auditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<number> {
    const expired = await this.invitationRepository.findExpiredUnnotified(props.now, props.limit);
    for (const invitation of expired) {
      invitation.expiryNotifiedAt = props.now;
      await this.invitationRepository.update(invitation);

      const workspace = await this.workspaceRepository.findById(invitation.workspaceId);
      const inviter = await this.userRepository.findById(invitation.invitedById);
      if (workspace && inviter?.isActive) {
        await this.dispatch.execute({
          users: [inviter],
          type: NotificationType.INVITATION_EXPIRED,
          title: invitation.email,
          ticketId: null,
          workspaceSlug: workspace.slug,
          inAppPrefKey: 'inAppInvitationExpired',
        });
      }

      await this.auditLog.execute({
        action: AuditAction.INVITATION_EXPIRED,
        entityType: 'invitation',
        entityId: invitation.getId(),
        userId: null,
        workspaceId: invitation.workspaceId,
        metadata: { email: invitation.email, role: invitation.role, invitedById: invitation.invitedById, expiresAt: invitation.expiresAt.toISOString() },
        category: AuditCategory.WORKSPACE,
        level: AuditLevel.INFO,
        source: 'system',
      });
    }
    return expired.length;
  }
}
