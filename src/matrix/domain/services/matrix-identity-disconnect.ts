import { IdGenerator } from '../../../shared/domain/id-generator';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { MatrixIdentityRepository } from '../repositories/matrix-identity.repository';
import { clearMatrixIdentityChange } from '../matrix-identity-status';
import { CloseMatrixDirectRooms } from './matrix-direct-rooms-close';

/**
 * Forgets a user's Matrix account: the bots leave their direct chats and nothing more is sent there.
 * The row stays without the ID, so the code limits are not reset by connecting again.
 */
export class DisconnectMatrixIdentity {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: MatrixIdentityRepository,
    private readonly closeRooms: CloseMatrixDirectRooms,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    const identity = await this.repository.findByUserId(userId);
    await this.closeRooms.execute(userId);
    if (identity?.pendingBotId && identity.pendingRoomId) await this.closeRooms.leaveUnsaved(identity.pendingBotId, identity.pendingRoomId);
    if (!identity?.matrixUserId) return;
    const matrixUserId = identity.matrixUserId;
    identity.matrixUserId = null;
    identity.verifiedAt = null;
    clearMatrixIdentityChange(identity);
    await this.repository.save(identity);

    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.MATRIX_ACCOUNT_DISCONNECTED,
      entityType: 'matrix-identity',
      entityId: identity.getId(),
      userId,
      workspaceId: null,
      metadata: { matrixUserId },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
    });
  }
}
