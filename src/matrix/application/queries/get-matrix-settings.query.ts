import { Query } from '../../../shared/domain/query';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { DEFAULT_MATRIX_NOTICE_EVENTS, MatrixNoticeEvent } from '../../domain/enums/matrix-notice-event.enum';
import { MatrixBotRepository } from '../../domain/repositories/matrix-bot.repository';
import { MatrixRoomRepository } from '../../domain/repositories/matrix-room.repository';
import { MatrixRoomScope } from '../../domain/enums/matrix-room-scope.enum';
import { matrixRoomScope } from '../../domain/matrix-room-scope';
import { FindMatrixRoomScope } from '../../domain/services/matrix-room-scope-find';
import { MatrixBotView, MatrixRoomView, matrixBotView, matrixRoomView } from '../matrix-views';

export interface MatrixSettingsResponse {
  /** The workspace's own bot, if it has one. */
  ownBot: MatrixBotView | null;
  /** The installation's bot, used when the workspace has none of its own. Only its ID. */
  installationBot: { userId: string } | null;
  /** Every room of the workspace, the one for the whole workspace first. */
  rooms: MatrixRoomView[];
  /** The room for the whole workspace, as before rooms per department, project and organization. */
  room: MatrixRoomView | null;
  events: MatrixNoticeEvent[];
  defaultEvents: MatrixNoticeEvent[];
}

export class GetMatrixSettingsQuery implements Query<{ workspaceId: string }, MatrixSettingsResponse> {
  constructor(
    private readonly botRepository: MatrixBotRepository,
    private readonly roomRepository: MatrixRoomRepository,
    private readonly cipher: SecretCipher,
    private readonly findScope: FindMatrixRoomScope,
  ) {}

  async execute(props: { workspaceId: string }): Promise<MatrixSettingsResponse> {
    const ownBot = await this.botRepository.findByWorkspaceId(props.workspaceId);
    const installation = await this.botRepository.findInstallation();
    const saved = await this.roomRepository.findByWorkspaceId(props.workspaceId);
    const rooms = await Promise.all(saved.map(async (r) => matrixRoomView(r, (await this.findScope.execute(props.workspaceId, matrixRoomScope(r)))?.name ?? null)));
    rooms.sort((a, b) => Number(b.scope === MatrixRoomScope.WORKSPACE) - Number(a.scope === MatrixRoomScope.WORKSPACE));
    return {
      ownBot: ownBot ? matrixBotView(ownBot, this.cipher) : null,
      installationBot: installation ? { userId: installation.userId } : null,
      rooms,
      room: rooms.find((r) => r.scope === MatrixRoomScope.WORKSPACE) ?? null,
      events: Object.values(MatrixNoticeEvent),
      defaultEvents: DEFAULT_MATRIX_NOTICE_EVENTS,
    };
  }
}
