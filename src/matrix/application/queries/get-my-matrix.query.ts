import { Query } from '../../../shared/domain/query';
import { MatrixIdentity } from '../../domain/entities/matrix-identity';
import { matrixIdentityStatus } from '../../domain/matrix-identity-status';
import { MatrixIdentityRepository } from '../../domain/repositories/matrix-identity.repository';
import { FindMatrixDirectBot } from '../../domain/services/matrix-direct-bot-find';
import { ListMatrixDirectChats } from '../../domain/services/matrix-direct-chats-list';
import { FindMatrixSetup, MatrixSetup } from '../../domain/services/matrix-setup-find';

export interface MyMatrixIdentityView {
  matrixUserId: string;
  status: 'pending' | 'verified';
  /** While a code is pending: when it stops working. */
  codeExpiresAt: string | null;
  /** A new ID being verified; until then the notices go on reaching matrixUserId. */
  pendingMatrixUserId: string | null;
}

export interface MyMatrixChatView {
  botId: string;
  botUserId: string;
  workspaces: string[];
  paused: boolean;
}

export interface MyMatrixView {
  /** Whether one of the user's workspaces can write on Matrix: otherwise there is nothing to connect. */
  available: boolean;
  /** The bot that sends the code, whose invitation the user is to accept first. */
  botUserId: string | null;
  identity: MyMatrixIdentityView | null;
  /** The bots that may write to the user, each in its own chat. */
  chats: MyMatrixChatView[];
  /** With no bot for the user: where they could connect one. Null when there is a bot, or for a customer. */
  setup: MatrixSetup | null;
}

/** Null when the user has no Matrix ID (never typed, or disconnected). */
export function myMatrixIdentityView(identity: MatrixIdentity | null): MyMatrixIdentityView | null {
  const status = matrixIdentityStatus(identity);
  if (status === 'none' || !identity?.matrixUserId) return null;
  return {
    matrixUserId: identity.matrixUserId,
    status,
    codeExpiresAt: (status === 'pending' || identity.pendingMatrixUserId) && identity.codeHash ? identity.codeExpiresAt?.toISOString() ?? null : null,
    pendingMatrixUserId: identity.pendingMatrixUserId,
  };
}

/** The user's own Matrix account for personal notices, and whether they can connect one. */
export class GetMyMatrixQuery implements Query<{ userId: string }, MyMatrixView> {
  constructor(
    private readonly identityRepository: MatrixIdentityRepository,
    private readonly findBot: FindMatrixDirectBot,
    private readonly listChats: ListMatrixDirectChats,
    private readonly findSetup: FindMatrixSetup,
  ) {}

  async execute(props: { userId: string }): Promise<MyMatrixView> {
    const bot = await this.findBot.execute(props.userId);
    const identity = await this.identityRepository.findByUserId(props.userId);
    const chats = await this.listChats.execute(props.userId);
    return {
      available: !!bot,
      botUserId: bot?.userId ?? null,
      identity: myMatrixIdentityView(identity),
      chats: chats.map((c) => ({ botId: c.bot.getId(), botUserId: c.bot.userId, workspaces: c.workspaceNames, paused: c.paused })),
      setup: bot ? null : await this.findSetup.execute(props.userId),
    };
  }
}
