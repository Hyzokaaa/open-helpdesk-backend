import { IdGenerator } from '../../../shared/domain/id-generator';
import { SecretCipher } from '../../../shared/domain/secret-cipher';
import { AuditLogRepository } from '../../../audit-log/domain/repositories/audit-log.repository';
import { MatrixPersonalNoticeEvent } from '../../../notification/domain/matrix-personal-notice';
import { TicketRepository } from '../../../ticket/domain/repositories/ticket.repository';
import { Ticket } from '../../../ticket/domain/entities/ticket';
import { ticketReferenceOf } from '../../../ticket/domain/ticket-reference';
import { User } from '../../../user/domain/entities/user';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { Workspace } from '../../../workspace/domain/entities/workspace';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixTicketThread } from '../entities/matrix-ticket-thread';
import { MatrixClient } from '../matrix-client';
import { matrixIdentityStatus } from '../matrix-identity-status';
import { MatrixNotice, matrixNoticeContent } from '../matrix-notice-content';
import { matrixText } from '../matrix-notice-texts';
import { MatrixNoticeThrottle } from '../matrix-notice-throttle';
import { Sleep, realSleep, withMatrixRetries } from '../matrix-retries';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixDirectRoomRepository } from '../repositories/matrix-direct-room.repository';
import { MatrixIdentityRepository } from '../repositories/matrix-identity.repository';
import { MatrixTicketThreadRepository } from '../repositories/matrix-ticket-thread.repository';
import { ResolveMatrixBot } from './matrix-bot-resolve';
import { MATRIX_TEAM_ROLES } from './matrix-direct-bot-find';
import { OpenMatrixDirectRoom } from './matrix-direct-room-open';
import { ReachMatrixDirectRoom } from './matrix-direct-room-reach';

/** The throttle's key for a user's chat with a bot: its summary goes to that chat. */
export function matrixDirectThrottleKey(botId: string, userId: string): string {
  return `direct:${botId}:${userId}`;
}

export interface MatrixDirectNotified {
  sent: number;
  /** Users it could not write to, and why; the others still got theirs. */
  failures: Array<{ userId: string; error: string }>;
}

/**
 * Sends a personal notice to each user's direct chat with the workspace's bot (its own, else the
 * installation's), in their language and threaded under the ticket. Only to team members with a
 * verified account. A user who left that chat has this bot's notices paused until they reconnect
 * it; the chats with other bots go on.
 */
export class NotifyMatrixDirect {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly client: MatrixClient,
    private readonly cipher: SecretCipher,
    private readonly botRepository: MatrixBotRepository,
    private readonly identityRepository: MatrixIdentityRepository,
    private readonly directRoomRepository: MatrixDirectRoomRepository,
    private readonly threadRepository: MatrixTicketThreadRepository,
    private readonly ticketRepository: TicketRepository,
    private readonly userRepository: UserRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly openRoom: OpenMatrixDirectRoom,
    private readonly frontendUrl: (workspaceId: string) => Promise<string>,
    private readonly throttle: MatrixNoticeThrottle,
    private readonly sleep: Sleep = realSleep,
  ) {}

  async execute(event: MatrixPersonalNoticeEvent): Promise<MatrixDirectNotified> {
    const result: MatrixDirectNotified = { sent: 0, failures: [] };
    const identities = (await this.identityRepository.findByUserIds(event.userIds)).filter((i) => matrixIdentityStatus(i) === 'verified');
    if (identities.length === 0) return result;

    const workspace = await this.workspaceRepository.findBySlug(event.workspaceSlug);
    if (!workspace) return result;
    const ticket = await this.ticketRepository.findById(event.ticketId);
    if (!ticket || ticket.workspaceId !== workspace.getId() || ticket.deletedAt) return result;
    const bot = await new ResolveMatrixBot(this.botRepository).execute(workspace.getId());
    const token = bot ? this.cipher.decrypt(bot.encryptedAccessToken) : null;
    if (!bot || !token) return result;

    const users = new Map((await this.userRepository.findByIds(identities.map((i) => i.userId))).map((u) => [u.getId(), u]));
    const url = `${await this.frontendUrl(workspace.getId())}/dashboard/workspaces/${workspace.slug}/tickets/${ticket.getId()}`;
    const occurrence = this.idGenerator.create();
    for (const identity of identities) {
      const user = users.get(identity.userId);
      if (!user || !identity.matrixUserId || !(await this.isTeam(workspace.getId(), user))) continue;
      try {
        // A paused chat is not counted against the minute's notices
        const paused = (await this.directRoomRepository.find(bot.getId(), user.getId()))?.lostAt;
        if (paused || !this.throttle.take(matrixDirectThrottleKey(bot.getId(), user.getId()))) continue;
        const notice = noticeOf(event, ticket, workspace, user.language, url);
        if (await this.send(notice, identity.matrixUserId, user, bot, token, ticket, occurrence)) result.sent++;
      } catch (error) {
        // One user's chat failing never keeps the notice from the others
        result.failures.push({ userId: user.getId(), error: (error as Error).message });
      }
    }
    return result;
  }

  private async send(notice: MatrixNotice, matrixUserId: string, user: User, bot: MatrixBot, token: string, ticket: Ticket, occurrence: string): Promise<boolean> {
    const room = await new ReachMatrixDirectRoom(this.idGenerator, this.client, this.cipher, this.directRoomRepository, this.auditLogRepository, this.openRoom, this.sleep)
      .execute({ bot, token, userId: user.getId(), matrixUserId, lang: user.language });
    if (!room) return false;

    const thread = await this.threadRepository.find(ticket.getId(), room.roomId);
    const content = matrixNoticeContent(notice, thread?.rootEventId ?? null);
    const txnId = `ohd-direct-${occurrence}-${user.getId()}`;
    const eventId = await withMatrixRetries(() => this.client.sendMessage(bot.homeserverUrl, token, room.roomId, txnId, content), this.sleep);
    if (!thread) {
      await this.threadRepository.save(new MatrixTicketThread({ id: this.idGenerator.create(), ticketId: ticket.getId(), roomId: room.roomId, rootEventId: eventId }));
    }
    return true;
  }

  private async isTeam(workspaceId: string, user: User): Promise<boolean> {
    if (!user.isActive) return false;
    const member = await this.memberRepository.findByWorkspaceAndUser(workspaceId, user.getId());
    return member ? MATRIX_TEAM_ROLES.has(member.role) : user.isSystemAdmin;
  }
}

const ICONS: Record<MatrixPersonalNoticeEvent['kind'], string> = {
  'ticket-created': '🎫',
  assigned: '👤',
  unassigned: '👤',
  'needs-assignee': '⚠️',
  'status-changed': '🔄',
  reopened: '🔁',
  comment: '💬',
  mention: '🔔',
  'unattended-reply': '📣',
  'transfer-request': '🔀',
  'transfer-accepted': '🔀',
  'transfer-rejected': '🔀',
  'transfer-cancelled': '🔀',
};

/** The notice in the user's language; never the ticket's or the comment's text, as in rooms by default. */
function noticeOf(event: MatrixPersonalNoticeEvent, ticket: Ticket, workspace: Workspace, lang: string | null, url: string): MatrixNotice {
  const ref = ticketReferenceOf(ticket);
  const name = event.actorName || '?';
  const status = (value: string | undefined) => matrixText(lang, `status.${value ?? ticket.status}` as never);
  const move = () => matrixText(lang, 'move', { from: status(event.oldStatus), to: status(event.newStatus) });
  const headline = (() => {
    switch (event.kind) {
      case 'ticket-created': return matrixText(lang, 'created', { ref });
      case 'assigned': return matrixText(lang, 'dmAssigned', { ref });
      case 'unassigned': return matrixText(lang, 'dmUnassigned', { ref });
      case 'needs-assignee': return matrixText(lang, 'dmNeedsAssignee', { ref, status: status(event.newStatus) });
      case 'status-changed': return matrixText(lang, 'status', { ref, move: move() });
      case 'reopened': return matrixText(lang, 'reopened', { ref, move: move() });
      case 'comment': return matrixText(lang, 'dmComment', { ref, name });
      case 'mention': return matrixText(lang, 'dmMentioned', { ref, name });
      case 'unattended-reply': return matrixText(lang, 'replyUnattended', { ref, name });
      case 'transfer-request': return matrixText(lang, 'dmTransferRequest', { ref, name });
      case 'transfer-accepted': return matrixText(lang, 'dmTransferAccepted', { ref });
      case 'transfer-rejected': return matrixText(lang, 'dmTransferRejected', { ref });
      case 'transfer-cancelled': return matrixText(lang, 'dmTransferCancelled', { ref });
    }
  })();
  return {
    icon: ICONS[event.kind],
    headline,
    subject: ticket.name,
    // Several workspaces can share the installation's bot, and so one chat
    details: [matrixText(lang, 'workspace', { value: workspace.name })],
    link: { url, label: matrixText(lang, 'openRef', { ref }) },
  };
}
