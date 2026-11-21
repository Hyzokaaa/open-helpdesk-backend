import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  workspaceId: string;
  /** When the bot was asked to create the room: the daily limit counts back from now. */
  createdAt: Date;
}

/** A room the bot was asked to create for a workspace, kept only to cap how many it creates a day. */
export class MatrixRoomCreation {
  readonly id: Id;
  workspaceId: string;
  createdAt: Date;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.createdAt = props.createdAt;
  }

  getId(): string {
    return this.id.get();
  }
}
