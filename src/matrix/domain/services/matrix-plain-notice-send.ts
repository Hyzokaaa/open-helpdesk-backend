import { EntityNotFoundError } from '../../../shared/domain/errors';
import { escapeHtml } from '../../../shared/domain/sanitize-html';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { MatrixRoom } from '../entities/matrix-room';
import { MatrixRoomScope } from '../enums/matrix-room-scope.enum';
import { MatrixTextKey, matrixText } from '../matrix-notice-texts';
import { matrixRoomScope } from '../matrix-room-scope';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';
import { ResolveMatrixBot } from './matrix-bot-resolve';
import { DeliverMatrixNotice, MatrixDelivery } from './matrix-notice-deliver';
import { FindMatrixRoomScope } from './matrix-room-scope-find';

const APP_NAME = process.env.APP_NAME || 'Open Helpdesk';

const TEST_TEXT: Record<MatrixRoomScope, MatrixTextKey> = {
  [MatrixRoomScope.WORKSPACE]: 'test',
  [MatrixRoomScope.DEPARTMENT]: 'testDepartment',
  [MatrixRoomScope.PROJECT]: 'testProject',
  [MatrixRoomScope.ORGANIZATION]: 'testOrganization',
};

/**
 * Notices that are about no ticket: the test an admin asks for, which also resumes a paused room
 * when it works, and the summary of the notices a busy minute left out.
 */
export class SendMatrixPlainNotice {
  constructor(
    private readonly roomRepository: MatrixRoomRepository,
    private readonly botRepository: MatrixBotRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly deliver: DeliverMatrixNotice,
  ) {}

  /** Sends the test notice to one of the workspace's rooms, naming who its notices are for; a paused room is resumed when it arrives. */
  async test(workspaceId: string, id: string, findScope: FindMatrixRoomScope): Promise<MatrixDelivery & { room: MatrixRoom; scopeName: string | null }> {
    const room = await this.roomRepository.findById(id);
    if (!room || room.workspaceId !== workspaceId) throw new EntityNotFoundError('Matrix room not found');
    const workspace = await this.workspaceRepository.findById(workspaceId);
    const scope = matrixRoomScope(room);
    // A department, project or organization deleted meanwhile reads as the whole workspace's
    const scopeName = (await findScope.execute(workspaceId, scope))?.name ?? null;
    const text = matrixText(workspace?.defaultLanguage, scopeName ? TEST_TEXT[scope.scope] : 'test', { app: APP_NAME, workspace: workspace?.name ?? '', name: scopeName ?? '' });

    const result = await this.send(room, text, `ohd-test-${Date.now()}`);
    if (result.sent && !room.isActive) {
      room.isActive = true;
      await this.roomRepository.save(room);
    }
    return { ...result, room, scopeName };
  }

  /** Tells a room how many notices were left out in a busy minute. */
  async skipped(roomId: string, count: number): Promise<void> {
    const room = await this.roomRepository.findById(roomId);
    if (!room?.isActive) return;
    const workspace = await this.workspaceRepository.findById(room.workspaceId);
    await this.send(room, matrixText(workspace?.defaultLanguage, 'skipped', { count }), `ohd-skipped-${room.getId()}-${Date.now()}`);
  }

  private async send(room: MatrixRoom, text: string, txnId: string): Promise<MatrixDelivery> {
    const bot = await new ResolveMatrixBot(this.botRepository).execute(room.workspaceId);
    if (!bot) return { sent: false, error: 'No Matrix bot is connected', lostAccess: false };
    return this.deliver.execute({
      room,
      bot,
      content: () => ({ msgtype: 'm.notice', body: `ℹ️ ${text}`, format: 'org.matrix.custom.html', formatted_body: `ℹ️ ${escapeHtml(text)}` }),
      txnId,
      ticketId: null,
    });
  }
}
