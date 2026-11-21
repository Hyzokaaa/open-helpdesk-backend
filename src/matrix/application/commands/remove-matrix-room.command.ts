import { Command } from '../../../shared/domain/command';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { RemoveMatrixRoom } from '../../domain/services/matrix-room-remove';
import { MatrixRoomLeft } from '../../domain/services/matrix-room-leave';

interface Props {
  workspaceId: string;
  id: string;
  /** The bot also leaves the room on the Matrix side. */
  botLeaves: boolean;
  actorId: string;
}

export class RemoveMatrixRoomCommand implements Command<Props, MatrixRoomLeft | null> {
  constructor(
    private readonly removeRoom: RemoveMatrixRoom,
    private readonly idGenerator: IdGenerator,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(props: Props): Promise<MatrixRoomLeft | null> {
    const { room, left } = await this.removeRoom.execute(props.workspaceId, props.id, props.botLeaves);
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.MATRIX_ROOM_REMOVED,
      entityType: 'matrix-room',
      entityId: room.getId(),
      userId: props.actorId,
      workspaceId: props.workspaceId,
      metadata: { roomId: room.roomId, ...(left && { botLeft: left.left, ...(left.error && { leaveError: left.error }) }) },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });
    return left;
  }
}
