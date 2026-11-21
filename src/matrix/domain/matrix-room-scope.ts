import { Ticket } from '../../ticket/domain/entities/ticket';
import { MatrixRoom } from './entities/matrix-room';
import { MatrixRoomScope } from './enums/matrix-room-scope.enum';

export interface MatrixRoomScopeOf {
  scope: MatrixRoomScope;
  /** The department, project or organization; null for the whole workspace. */
  scopeId: string | null;
}

/** Which tickets a room hears of. */
export function matrixRoomScope(room: MatrixRoom): MatrixRoomScopeOf {
  if (room.departmentId) return { scope: MatrixRoomScope.DEPARTMENT, scopeId: room.departmentId };
  if (room.projectId) return { scope: MatrixRoomScope.PROJECT, scopeId: room.projectId };
  if (room.organizationId) return { scope: MatrixRoomScope.ORGANIZATION, scopeId: room.organizationId };
  return { scope: MatrixRoomScope.WORKSPACE, scopeId: null };
}

/** The room's columns for a scope: at most one of them is set. */
export function matrixRoomScopeColumns(scope: MatrixRoomScopeOf): Pick<MatrixRoom, 'departmentId' | 'projectId' | 'organizationId'> {
  return {
    departmentId: scope.scope === MatrixRoomScope.DEPARTMENT ? scope.scopeId : null,
    projectId: scope.scope === MatrixRoomScope.PROJECT ? scope.scopeId : null,
    organizationId: scope.scope === MatrixRoomScope.ORGANIZATION ? scope.scopeId : null,
  };
}

/** Whether the ticket is one the room hears of. */
export function matrixRoomCovers(room: MatrixRoom, ticket: Ticket): boolean {
  const { scope, scopeId } = matrixRoomScope(room);
  switch (scope) {
    case MatrixRoomScope.DEPARTMENT: return ticket.departmentId === scopeId;
    case MatrixRoomScope.PROJECT: return ticket.projectId === scopeId;
    case MatrixRoomScope.ORGANIZATION: return ticket.organizationId === scopeId;
    default: return true;
  }
}

/**
 * Of the rooms that would tell of a ticket, the ones that do: all of them, except a room for the
 * whole workspace that leaves out the tickets another room already tells of.
 */
export function matrixRoomsToTell(rooms: MatrixRoom[]): MatrixRoom[] {
  const others = rooms.some((r) => matrixRoomScope(r).scope !== MatrixRoomScope.WORKSPACE);
  return rooms.filter((r) => !(others && r.onlyTicketsWithoutOtherRoom && matrixRoomScope(r).scope === MatrixRoomScope.WORKSPACE));
}
