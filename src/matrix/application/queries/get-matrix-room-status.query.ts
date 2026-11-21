import { Query } from '../../../shared/domain/query';
import { InspectMatrixRoom, MatrixRoomStatus } from '../../domain/services/matrix-room-inspect';

interface Props {
  workspaceId: string;
  id: string;
}

export class GetMatrixRoomStatusQuery implements Query<Props, MatrixRoomStatus> {
  constructor(private readonly inspect: InspectMatrixRoom) {}

  async execute(props: Props): Promise<MatrixRoomStatus> {
    return this.inspect.execute(props);
  }
}
