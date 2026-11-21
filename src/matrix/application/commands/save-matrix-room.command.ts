import { Command } from '../../../shared/domain/command';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { MatrixNoticeEvent } from '../../domain/enums/matrix-notice-event.enum';
import { MatrixRoomScope } from '../../domain/enums/matrix-room-scope.enum';
import { matrixRoomScope } from '../../domain/matrix-room-scope';
import { FindMatrixRoomScope } from '../../domain/services/matrix-room-scope-find';
import { SaveMatrixRoom } from '../../domain/services/matrix-room-save';
import { CreatedMatrixRoom, NewMatrixRoom } from '../../domain/services/matrix-room-create';
import { MatrixRoomView, matrixRoomView } from '../matrix-views';

interface Props {
  workspaceId: string;
  /** The room being edited; none to add one. */
  id?: string;
  request: {
    /** An existing room; or newRoom, for the bot to create one. */
    room?: string;
    newRoom?: NewMatrixRoom;
    scope: MatrixRoomScope;
    scopeId?: string | null;
    events: MatrixNoticeEvent[];
    includeText: boolean;
    includeFiles: boolean;
    onlyTicketsWithoutOtherRoom: boolean;
  };
  actorId: string;
  actorIsSystemAdmin: boolean;
}

export interface SaveMatrixRoomResponse {
  room: MatrixRoomView;
  /** When the bot created the room: who it could not invite, and whether they became admins. */
  created: Omit<CreatedMatrixRoom, 'roomId'> | null;
}

export class SaveMatrixRoomCommand implements Command<Props, SaveMatrixRoomResponse> {
  constructor(
    private readonly saveRoom: SaveMatrixRoom,
    private readonly findScope: FindMatrixRoomScope,
    private readonly idGenerator: IdGenerator,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(props: Props): Promise<SaveMatrixRoomResponse> {
    const { scope, scopeId, room: typed, newRoom, ...request } = props.request;
    const { room, created } = await this.saveRoom.execute({
      workspaceId: props.workspaceId,
      id: props.id,
      ...request,
      room: newRoom ? { create: newRoom } : typed ?? '',
      scope: { scope, scopeId: scopeId ?? null },
      actorIsSystemAdmin: props.actorIsSystemAdmin,
    });
    const view = matrixRoomView(room, (await this.findScope.execute(props.workspaceId, matrixRoomScope(room)))?.name ?? null);
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.MATRIX_ROOM_CONFIGURED,
      entityType: 'matrix-room',
      entityId: room.getId(),
      userId: props.actorId,
      workspaceId: props.workspaceId,
      metadata: {
        roomId: room.roomId,
        scope: view.scope,
        ...(view.scopeId && { scopeId: view.scopeId, scopeName: view.scopeName }),
        ...(props.id && { edited: true }),
        ...(created && {
          created: true,
          invited: newRoom!.invite.filter((u) => !created.notInvited.some((n) => n.userId === u)),
          ...(created.notInvited.length > 0 && { notInvited: created.notInvited.map((n) => n.userId) }),
          ...(!created.adminsSet && { adminsNotSet: true }),
        }),
        events: room.events,
        includeText: room.includeText,
        includeFiles: room.includeFiles,
        ...(room.onlyTicketsWithoutOtherRoom && { onlyTicketsWithoutOtherRoom: true }),
      },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });
    return { room: view, created: created && { notInvited: created.notInvited, adminsSet: created.adminsSet } };
  }
}
