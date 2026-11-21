import { Command } from '../../../shared/domain/command';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { PauseMatrixRoom } from '../../domain/services/matrix-room-pause';
import { MatrixRoomView, matrixRoomView } from '../matrix-views';

interface Props {
  workspaceId: string;
  id: string;
  actorId: string;
}

export class PauseMatrixRoomCommand implements Command<Props, MatrixRoomView> {
  constructor(
    private readonly pauseRoom: PauseMatrixRoom,
    private readonly idGenerator: IdGenerator,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(props: Props): Promise<MatrixRoomView> {
    const room = await this.pauseRoom.execute(props.workspaceId, props.id);
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.MATRIX_ROOM_PAUSED,
      entityType: 'matrix-room',
      entityId: room.getId(),
      userId: props.actorId,
      workspaceId: props.workspaceId,
      metadata: { roomId: room.roomId, byHand: true },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });
    return matrixRoomView(room);
  }
}
