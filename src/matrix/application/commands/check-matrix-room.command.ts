import { Command } from '../../../shared/domain/command';
import { CheckMatrixRoom, MatrixRoomCheck } from '../../domain/services/matrix-room-check';

interface Props {
  workspaceId: string;
  room: string;
  actorIsSystemAdmin: boolean;
}

/** Shows that a room exists and the bot is in it, before or after saving it. Changes no setting. */
export class CheckMatrixRoomCommand implements Command<Props, MatrixRoomCheck> {
  constructor(private readonly checkRoom: CheckMatrixRoom) {}

  execute(props: Props): Promise<MatrixRoomCheck> {
    return this.checkRoom.execute({ workspaceId: props.workspaceId, room: props.room, actorIsSystemAdmin: props.actorIsSystemAdmin });
  }
}
