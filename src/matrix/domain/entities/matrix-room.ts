import { Id } from '../../../shared/domain/id';
import { MatrixNoticeEvent } from '../enums/matrix-notice-event.enum';

interface Props {
  id: string;
  workspaceId: string;
  /** The room's ID (!…), never an alias: aliases are resolved when the room is saved. */
  roomId: string;
  /** At most one of the three is set: the room hears of that department's, project's or organization's tickets; none for every ticket of the workspace. */
  departmentId: string | null;
  projectId?: string | null;
  organizationId?: string | null;
  /** A room for the whole workspace may leave out the tickets another room already hears of. */
  onlyTicketsWithoutOtherRoom?: boolean;
  events: MatrixNoticeEvent[];
  /** Whether notices carry the start of the ticket's text and of customer replies. */
  includeText: boolean;
  /** Whether notices carry the images and documents attached to the ticket or reply. */
  includeFiles: boolean;
  /** False once the bot lost access (token revoked, removed from the room), until a test succeeds. */
  isActive: boolean;
  lastError: string | null;
  lastErrorAt: Date | null;
}

/** A Matrix room a workspace's notices go to. */
export class MatrixRoom {
  readonly id: Id;
  workspaceId: string;
  roomId: string;
  departmentId: string | null;
  projectId: string | null;
  organizationId: string | null;
  onlyTicketsWithoutOtherRoom: boolean;
  events: MatrixNoticeEvent[];
  includeText: boolean;
  includeFiles: boolean;
  isActive: boolean;
  lastError: string | null;
  lastErrorAt: Date | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.roomId = props.roomId;
    this.departmentId = props.departmentId;
    this.projectId = props.projectId ?? null;
    this.organizationId = props.organizationId ?? null;
    this.onlyTicketsWithoutOtherRoom = props.onlyTicketsWithoutOtherRoom ?? false;
    this.events = props.events;
    this.includeText = props.includeText;
    this.includeFiles = props.includeFiles;
    this.isActive = props.isActive;
    this.lastError = props.lastError;
    this.lastErrorAt = props.lastErrorAt;
  }

  getId(): string {
    return this.id.get();
  }
}
