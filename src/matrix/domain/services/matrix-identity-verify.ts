import { IdGenerator } from '../../../shared/domain/id-generator';
import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { MatrixIdentity } from '../entities/matrix-identity';
import { MATRIX_CODE_MAX_ATTEMPTS, matrixCodeMatches } from '../matrix-verification-code';
import { MatrixIdentityRepository } from '../repositories/matrix-identity.repository';
import { MatrixDirectRoomRepository } from '../repositories/matrix-direct-room.repository';
import { MatrixDirectRoom } from '../entities/matrix-direct-room';
import { clearMatrixIdentityChange } from '../matrix-identity-status';
import { CloseMatrixDirectRooms } from './matrix-direct-rooms-close';

/**
 * Checks the code the bot sent: right, the account is verified; wrong too often or too late, a new one
 * is needed. For a new ID replacing a verified one, the old one's chats close only now, and the chat
 * the code went to becomes that bot's direct chat with the user.
 */
export class VerifyMatrixIdentity {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: MatrixIdentityRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly directRoomRepository: MatrixDirectRoomRepository,
    private readonly closeRooms: CloseMatrixDirectRooms,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(props: { userId: string; code: string }): Promise<MatrixIdentity> {
    const identity = await this.repository.findByUserId(props.userId);
    if (!identity?.matrixUserId || !identity.codeHash || !identity.codeExpiresAt) {
      throw new EntityNotFoundError('There is no code to check: ask for one first', 'matrix-no-code');
    }
    if (identity.codeExpiresAt.getTime() <= this.now().getTime()) throw new DomainValidationError('The code expired: ask for a new one', 'matrix-code-expired');

    // Every try counts, the right one too, before the code is compared: tries sent at once cannot share one
    const tries = await this.repository.claimCodeAttempt(identity.getId(), MATRIX_CODE_MAX_ATTEMPTS);
    if (tries === null) throw new DomainValidationError('Too many wrong codes: ask for a new one', 'matrix-too-many-wrong');

    if (!matrixCodeMatches(identity.getId(), props.code, identity.codeHash)) {
      throw tries < MATRIX_CODE_MAX_ATTEMPTS
        ? new DomainValidationError('That code is not right', 'matrix-wrong-code')
        : new DomainValidationError('Too many wrong codes: ask for a new one', 'matrix-too-many-wrong');
    }

    const previous = identity.pendingMatrixUserId ? identity.matrixUserId : null;
    if (identity.pendingMatrixUserId) await this.switchToPending(identity);
    identity.verifiedAt = this.now();
    clearMatrixIdentityChange(identity);
    await this.repository.save(identity);

    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.MATRIX_ACCOUNT_CONNECTED,
      entityType: 'matrix-identity',
      entityId: identity.getId(),
      userId: props.userId,
      workspaceId: null,
      metadata: { matrixUserId: identity.matrixUserId, ...(previous && { previous }) },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
    });
    return identity;
  }

  private async switchToPending(identity: MatrixIdentity): Promise<void> {
    const matrixUserId = identity.pendingMatrixUserId!;
    await this.closeRooms.execute(identity.userId);
    identity.matrixUserId = matrixUserId;
    if (!identity.pendingBotId || !identity.pendingRoomId) return;
    // The bot removed meanwhile, or a notice opening a chat at that moment: the next notice opens one
    await this.directRoomRepository.save(new MatrixDirectRoom({
      id: this.idGenerator.create(),
      botId: identity.pendingBotId,
      userId: identity.userId,
      matrixUserId,
      roomId: identity.pendingRoomId,
      lostAt: null,
    })).catch(() => undefined);
  }
}
