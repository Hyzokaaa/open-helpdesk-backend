import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixDirectRoomRepository } from '../repositories/matrix-direct-room.repository';
import { ResolveMatrixBot } from './matrix-bot-resolve';
import { MATRIX_TEAM_ROLES } from './matrix-direct-bot-find';

export interface MatrixDirectChat {
  bot: MatrixBot;
  /** The user's workspaces this bot writes for (none for a system admin on no team). */
  workspaceNames: string[];
  /** The user left or rejected this bot's chat: its notices wait until they reconnect it. */
  paused: boolean;
}

/**
 * The bots that may write to a user on Matrix, one per chat: each workspace's own bot, or the
 * installation's for those without one. So the user knows whose invitations to expect.
 */
export class ListMatrixDirectChats {
  constructor(
    private readonly botRepository: MatrixBotRepository,
    private readonly directRoomRepository: MatrixDirectRoomRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string): Promise<MatrixDirectChat[]> {
    const memberships = (await this.memberRepository.findByUserId(userId)).filter((m) => MATRIX_TEAM_ROLES.has(m.role));
    const resolve = new ResolveMatrixBot(this.botRepository);
    const chats = new Map<string, MatrixDirectChat>();
    for (const membership of memberships) {
      const bot = await resolve.execute(membership.workspaceId);
      if (!bot) continue;
      const workspace = await this.workspaceRepository.findById(membership.workspaceId);
      const chat = chats.get(bot.getId()) ?? { bot, workspaceNames: [], paused: false };
      if (workspace) chat.workspaceNames.push(workspace.name);
      chats.set(bot.getId(), chat);
    }
    if (chats.size === 0 && (await this.userRepository.findById(userId))?.isSystemAdmin) {
      const installation = await this.botRepository.findInstallation();
      if (installation) chats.set(installation.getId(), { bot: installation, workspaceNames: [], paused: false });
    }

    const rooms = await this.directRoomRepository.findByUserId(userId);
    for (const chat of chats.values()) {
      chat.paused = !!rooms.find((r) => r.botId === chat.bot.getId())?.lostAt;
      chat.workspaceNames.sort((a, b) => a.localeCompare(b));
    }
    return [...chats.values()];
  }
}
