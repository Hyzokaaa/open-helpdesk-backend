import { Command } from '../../../shared/domain/command';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { SendMatrixPlainNotice } from '../../domain/services/matrix-plain-notice-send';
import { FindMatrixRoomScope } from '../../domain/services/matrix-room-scope-find';
import { MatrixRoomView, matrixRoomView } from '../matrix-views';

interface Props {
  workspaceId: string;
  id: string;
  actorId: string;
}

export type MatrixTestResponse = { success: true; room: MatrixRoomView } | { success: false; error: string; room: MatrixRoomView };

export class SendMatrixTestNoticeCommand implements Command<Props, MatrixTestResponse> {
  constructor(
    private readonly plainNotice: SendMatrixPlainNotice,
    private readonly findScope: FindMatrixRoomScope,
    private readonly idGenerator: IdGenerator,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(props: Props): Promise<MatrixTestResponse> {
    const result = await this.plainNotice.test(props.workspaceId, props.id, this.findScope);
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.MATRIX_TEST_NOTICE,
      entityType: 'matrix-room',
      entityId: result.room.getId(),
      userId: props.actorId,
      workspaceId: props.workspaceId,
      metadata: { roomId: result.room.roomId, success: result.sent, ...(!result.sent && { error: result.error }) },
      category: AuditCategory.CONFIG,
      level: result.sent ? AuditLevel.INFO : AuditLevel.WARNING,
      source: 'ui',
    });
    const room = matrixRoomView(result.room, result.scopeName);
    return result.sent ? { success: true, room } : { success: false, error: result.error, room };
  }
}
