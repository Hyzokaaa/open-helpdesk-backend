import { ConflictError, DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { MatrixRoom } from '../entities/matrix-room';
import { MatrixNoticeEvent } from '../enums/matrix-notice-event.enum';
import { MatrixRoomScope } from '../enums/matrix-room-scope.enum';
import { MatrixClient } from '../matrix-client';
import { MatrixRoomScopeOf, matrixRoomScope, matrixRoomScopeColumns } from '../matrix-room-scope';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';
import { CheckMatrixRoom, ResolvedMatrixRoom } from './matrix-room-check';
import { CreateMatrixRoom, CreatedMatrixRoom, NewMatrixRoom } from './matrix-room-create';
import { ReserveMatrixRoomCreation } from './matrix-room-creation-reserve';
import { FindMatrixRoomScope } from './matrix-room-scope-find';

interface Props {
  workspaceId: string;
  /** The room being edited; none to add one. */
  id?: string;
  /** The room's ID (!…) or an alias (#name:server), or a room for the bot to create. */
  room: string | { create: NewMatrixRoom };
  scope: MatrixRoomScopeOf;
  events: MatrixNoticeEvent[];
  includeText: boolean;
  includeFiles: boolean;
  /** Only for the room of the whole workspace. */
  onlyTicketsWithoutOtherRoom: boolean;
  /** A system admin may point several workspaces at one room; anyone else only at a room no other workspace uses. */
  actorIsSystemAdmin: boolean;
}

export interface SavedMatrixRoom {
  room: MatrixRoom;
  /** When the bot created the room: who it could not invite. */
  created: CreatedMatrixRoom | null;
}

/**
 * Adds or edits one of the workspace's rooms: the bot joins it (accepting the invitation) so a
 * wrong room or a missing invitation shows now, not at the first ticket. One room per scope (the
 * whole workspace, or one department, project or organization), and a Matrix room only once per
 * workspace, so no ticket is told twice in the same room. A room for the bot to create is created
 * only once everything else is right, so a refused setting does not leave an unused room behind.
 */
export class SaveMatrixRoom {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly roomRepository: MatrixRoomRepository,
    private readonly botRepository: MatrixBotRepository,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly findScope: FindMatrixRoomScope,
    /** Caps how many rooms the bot creates for a workspace a day. */
    private readonly reserveCreation: ReserveMatrixRoomCreation,
  ) {}

  async execute(props: Props): Promise<SavedMatrixRoom> {
    const events = [...new Set(props.events)].filter((e) => Object.values(MatrixNoticeEvent).includes(e));
    const scope: MatrixRoomScopeOf = props.scope.scope === MatrixRoomScope.WORKSPACE
      ? { scope: MatrixRoomScope.WORKSPACE, scopeId: null }
      : props.scope;
    if (scope.scope !== MatrixRoomScope.WORKSPACE && !(await this.findScope.execute(props.workspaceId, scope))) {
      throw new DomainValidationError(`That ${scope.scope} does not exist in this workspace`);
    }

    const rooms = await this.roomRepository.findByWorkspaceId(props.workspaceId);
    const existing = props.id ? rooms.find((r) => r.getId() === props.id) : undefined;
    if (props.id && !existing) throw new EntityNotFoundError('Matrix room not found');
    const others = rooms.filter((r) => r.getId() !== props.id);
    if (others.some((r) => sameScope(matrixRoomScope(r), scope))) {
      throw new ConflictError(scope.scope === MatrixRoomScope.WORKSPACE ? 'The whole workspace already has a room' : `That ${scope.scope} already has a room`);
    }

    // An existing room is known by its ID first, so the bot does not join a room it may not use
    const check = new CheckMatrixRoom(this.botRepository, this.roomRepository, this.client, this.cipher);
    let created: CreatedMatrixRoom | null = null;
    let resolved: ResolvedMatrixRoom | null = null;
    let roomId: string;
    if (typeof props.room === 'string') {
      resolved = await check.resolve(props.workspaceId, props.room);
      roomId = resolved.roomId;
    } else {
      const newRoom = CreateMatrixRoom.validate(props.room.create);
      const creation = await this.reserveCreation.execute(props.workspaceId);
      // A failure leaves no room with invitations behind: it does not count
      created = await new CreateMatrixRoom(this.botRepository, this.client, this.cipher).execute({ workspaceId: props.workspaceId, ...newRoom })
        .catch(async (error) => {
          await this.reserveCreation.release(creation);
          throw error;
        });
      roomId = created.roomId;
    }
    if (others.some((r) => r.roomId === roomId)) throw new ConflictError('This workspace already sends notices to that room');
    await check.refuseAnotherWorkspaces(props.workspaceId, roomId, props.actorIsSystemAdmin);
    if (resolved) await check.enter(resolved);

    const room = new MatrixRoom({
      id: existing?.getId() ?? this.idGenerator.create(),
      workspaceId: props.workspaceId,
      roomId,
      ...matrixRoomScopeColumns(scope),
      onlyTicketsWithoutOtherRoom: scope.scope === MatrixRoomScope.WORKSPACE && props.onlyTicketsWithoutOtherRoom,
      events,
      includeText: props.includeText,
      includeFiles: props.includeFiles,
      isActive: true,
      lastError: null,
      lastErrorAt: null,
    });
    await this.roomRepository.save(room);
    return { room, created };
  }
}

function sameScope(a: MatrixRoomScopeOf, b: MatrixRoomScopeOf): boolean {
  return a.scope === b.scope && a.scopeId === b.scopeId;
}
