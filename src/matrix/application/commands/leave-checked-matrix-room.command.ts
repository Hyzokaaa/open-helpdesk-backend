import { Command } from '../../../shared/domain/command';
import { LeaveCheckedMatrixRoom } from '../../domain/services/matrix-room-checked-leave';

interface Props {
  workspaceId: string;
  room: string;
}

export class LeaveCheckedMatrixRoomCommand implements Command<Props, { left: boolean }> {
  constructor(private readonly leave: LeaveCheckedMatrixRoom) {}

  async execute(props: Props): Promise<{ left: boolean }> {
    return this.leave.execute(props);
  }
}
