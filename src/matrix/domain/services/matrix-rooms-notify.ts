import { htmlToPlainText } from '../../../shared/domain/sanitize-plain-text';
import { TicketRepository } from '../../../ticket/domain/repositories/ticket.repository';
import { Ticket } from '../../../ticket/domain/entities/ticket';
import { ticketReferenceOf } from '../../../ticket/domain/ticket-reference';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { User } from '../../../user/domain/entities/user';
import { DepartmentRepository } from '../../../department/domain/repositories/department.repository';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { MatrixRoom } from '../entities/matrix-room';
import { MatrixBot } from '../entities/matrix-bot';
import { MatrixNoticeEvent } from '../enums/matrix-notice-event.enum';
import { MatrixNotice, matrixNoticeContent, matrixThreadNoteContent } from '../matrix-notice-content';
import { MatrixFileSource, MatrixNoticeFile, matrixFilesToSend } from '../matrix-notice-files';
import { matrixText } from '../matrix-notice-texts';
import { MatrixNoticeThrottle } from '../matrix-notice-throttle';
import { matrixRoomCovers, matrixRoomsToTell } from '../matrix-room-scope';
import { MatrixBotRepository } from '../repositories/matrix-bot.repository';
import { MatrixRoomRepository } from '../repositories/matrix-room.repository';
import { ResolveMatrixBot } from './matrix-bot-resolve';
import { DeliverMatrixNotice } from './matrix-notice-deliver';

/** How much of a ticket's or reply's text a notice carries, when its room includes text. */
export const MATRIX_EXCERPT_LENGTH = 300;
/** A new ticket from an older email (a mailbox read for the first time) is not news to announce. */
const HISTORICAL_AFTER_MS = 60 * 60 * 1000;

const TEAM_ROLES = new Set<WorkspaceRole>([WorkspaceRole.ADMIN, WorkspaceRole.SUPERVISOR, WorkspaceRole.AGENT]);

export type MatrixTicketChange =
  | { event: MatrixNoticeEvent.TICKET_CREATED }
  /** statusChange: the same assignment also moved the status. */
  | { event: MatrixNoticeEvent.TICKET_ASSIGNED; assigneeId: string | null; statusChange?: { oldStatus: string; newStatus: string } }
  /** assigneeChange: the same status change also moved the assignee. */
  | { event: MatrixNoticeEvent.STATUS_CHANGED; oldStatus: string; newStatus: string; reopened: boolean; actorId: string | null; assigneeChange?: { newAssigneeId: string | null } }
  /** Any comment: told as a customer reply or a team comment depending on who wrote it. */
  | { event: MatrixNoticeEvent.CUSTOMER_REPLY; authorId: string; commentId: string; commentText: string }
  | { event: MatrixNoticeEvent.SLA_BREACHED; target: 'first-response' | 'resolution' };

interface Target {
  workspaceId: string;
  ticketId: string;
  /** Tells this occurrence apart from others of the same kind (a comment ID, the time of a change). */
  occurrence: string;
}

type Props = MatrixTicketChange & Target;

/** A change once its author is known: a comment by the team is not a customer reply. */
type Change = (MatrixTicketChange | { event: MatrixNoticeEvent.TEAM_COMMENT; authorId: string; commentId: string; commentText: string }) & Target;

/**
 * Tells the workspace's rooms that hear of this kind of change about it, in the workspace's
 * language, threaded under the ticket. Never the ticket's text unless the room asked for it.
 */
export class NotifyMatrixRooms {
  constructor(
    private readonly roomRepository: MatrixRoomRepository,
    private readonly botRepository: MatrixBotRepository,
    private readonly ticketRepository: TicketRepository,
    private readonly userRepository: UserRepository,
    private readonly departmentRepository: DepartmentRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly frontendUrl: (workspaceId: string) => Promise<string>,
    private readonly throttle: MatrixNoticeThrottle,
    private readonly deliver: DeliverMatrixNotice,
    private readonly files: MatrixFileSource,
  ) {}

  async execute(given: Props): Promise<number> {
    const rooms = (await this.roomRepository.findByWorkspaceId(given.workspaceId)).filter((r) => r.isActive);
    if (rooms.length === 0) return 0;

    const ticket = await this.ticketRepository.findById(given.ticketId);
    if (!ticket || ticket.workspaceId !== given.workspaceId || ticket.deletedAt) return 0;
    const props = await this.classify(given);
    const targets = matrixRoomsToTell(rooms.filter((r) => matrixRoomCovers(r, ticket) && hears(r, props, ticket)));
    if (targets.length === 0 || !isNews(props, ticket)) return 0;

    const bot = await new ResolveMatrixBot(this.botRepository).execute(props.workspaceId);
    const workspace = await this.workspaceRepository.findById(props.workspaceId);
    if (!bot || !workspace) return 0;

    const lang = workspace.defaultLanguage ?? 'en';
    const url = `${await this.frontendUrl(props.workspaceId)}/dashboard/workspaces/${workspace.slug}/tickets/${ticket.getId()}`;
    const files = await this.filesOf(props, ticket);
    const txnId = `ohd-${props.event}-${ticket.getId()}-${props.occurrence}`;
    let sent = 0;
    for (const room of targets) {
      if (!this.throttle.take(room.getId())) continue;
      const notice = await this.notice(props, ticket, room, lang, url);
      if (files.length > 0) notice.details.push(matrixText(lang, files.length === 1 ? 'filesOne' : 'filesMany', { count: files.length }));
      const result = await this.deliver.execute({
        room,
        bot,
        content: (root) => matrixNoticeContent(notice, root),
        txnId,
        ticketId: ticket.getId(),
        opensThread: props.event === MatrixNoticeEvent.TICKET_CREATED,
      });
      if (!result.sent) continue;
      sent++;
      if (room.includeFiles) await this.sendFiles(room, bot, result.threadRootEventId, files, txnId, lang);
    }
    return sent;
  }

  /** A comment is a customer reply unless the team wrote it. */
  private async classify(props: Props): Promise<Change> {
    if (props.event !== MatrixNoticeEvent.CUSTOMER_REPLY || !(await this.isTeam(props.workspaceId, props.authorId))) return props;
    return { ...props, event: MatrixNoticeEvent.TEAM_COMMENT };
  }

  /** The files of what the notice is about: the new ticket's own, or the comment's. */
  private async filesOf(props: Change, ticket: Ticket): Promise<MatrixNoticeFile[]> {
    if (props.event === MatrixNoticeEvent.TICKET_CREATED) return this.files.list(ticket.getId(), null);
    if (props.event === MatrixNoticeEvent.CUSTOMER_REPLY || props.event === MatrixNoticeEvent.TEAM_COMMENT) return this.files.list(ticket.getId(), props.commentId);
    return [];
  }

  /** The images and documents, one message each in the thread; each counts against the room's limit. */
  private async sendFiles(room: MatrixRoom, bot: MatrixBot, threadRootEventId: string, files: MatrixNoticeFile[], txnId: string, lang: string): Promise<void> {
    const { send, tooLarge } = matrixFilesToSend(files);
    for (const file of tooLarge) {
      if (!this.throttle.take(room.getId())) return;
      const text = matrixText(lang, 'fileFailed', { name: file.name });
      await this.deliver.execute({ room, bot, content: () => matrixThreadNoteContent(text, threadRootEventId), txnId: `${txnId}-file-${file.id}-failed`, ticketId: null });
    }
    for (const file of send) {
      if (!this.throttle.take(room.getId())) return;
      const failedText = matrixText(lang, 'fileFailed', { name: file.name });
      const result = await this.deliver.sendFile({ room, bot, threadRootEventId, txnId: `${txnId}-file-${file.id}`, file, read: () => this.files.read(file), failedText });
      if (!result.sent && result.lostAccess) return;
    }
  }

  private async notice(props: Change, ticket: Ticket, room: MatrixRoom, lang: string, url: string): Promise<MatrixNotice> {
    const ref = ticketReferenceOf(ticket);
    const reporter = await this.userRepository.findById(ticket.reporterId);
    const department = ticket.departmentId ? await this.departmentRepository.findById(ticket.departmentId) : null;
    const details = [
      matrixText(lang, 'priority', { value: matrixText(lang, `priority.${ticket.priority}` as never) }),
      reporter ? matrixText(lang, 'customer', { value: nameOf(reporter) }) : '',
      department ? matrixText(lang, 'department', { value: department.name }) : '',
    ];
    const base = { subject: ticket.name, details, link: { url, label: matrixText(lang, 'open') } };
    const excerpt = (text: string) => (room.includeText ? htmlToPlainText(text, MATRIX_EXCERPT_LENGTH) || null : null);

    switch (props.event) {
      case MatrixNoticeEvent.TICKET_CREATED:
        return { ...base, icon: '🎫', headline: matrixText(lang, 'created', { ref }), excerpt: excerpt(ticket.description) };
      case MatrixNoticeEvent.TICKET_ASSIGNED: {
        const assignee = props.assigneeId ? await this.userRepository.findById(props.assigneeId) : null;
        const headline = assignee ? matrixText(lang, 'assigned', { ref, name: nameOf(assignee) }) : matrixText(lang, 'unassigned', { ref });
        const status = props.statusChange ? move(lang, props.statusChange.oldStatus, props.statusChange.newStatus) : null;
        return { ...base, icon: '👤', headline: status ? `${headline} · ${status}` : headline };
      }
      case MatrixNoticeEvent.STATUS_CHANGED: {
        const actor = props.actorId ? await this.userRepository.findById(props.actorId) : null;
        const status = move(lang, props.oldStatus, props.newStatus);
        let headline = matrixText(lang, props.reopened ? 'reopened' : 'status', { ref, move: status });
        if (props.assigneeChange) {
          const assignee = props.assigneeChange.newAssigneeId ? await this.userRepository.findById(props.assigneeChange.newAssigneeId) : null;
          headline += ` · ${assignee ? matrixText(lang, 'assignedTo', { name: nameOf(assignee) }) : matrixText(lang, 'leftUnassigned')}`;
        }
        return { ...base, icon: props.reopened ? '🔁' : '🔄', headline, details: actor ? [...details, matrixText(lang, 'by', { value: nameOf(actor) })] : details };
      }
      case MatrixNoticeEvent.TEAM_COMMENT: {
        const author = await this.userRepository.findById(props.authorId);
        return { ...base, icon: '🗨️', headline: matrixText(lang, 'teamComment', { name: author ? nameOf(author) : '?', ref }), excerpt: excerpt(props.commentText) };
      }
      case MatrixNoticeEvent.CUSTOMER_REPLY: {
        const author = await this.userRepository.findById(props.authorId);
        const name = author ? nameOf(author) : '?';
        const headline = ticket.assigneeId ? matrixText(lang, 'reply', { name, ref }) : matrixText(lang, 'replyUnattended', { name, ref });
        return { ...base, icon: ticket.assigneeId ? '💬' : '📣', headline, excerpt: excerpt(props.commentText) };
      }
      case MatrixNoticeEvent.SLA_BREACHED:
        return { ...base, icon: '⏰', headline: matrixText(lang, props.target === 'first-response' ? 'slaFirstResponse' : 'slaResolution', { ref }) };
    }
  }

  private async isTeam(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepository.findByWorkspaceAndUser(workspaceId, userId);
    if (member) return TEAM_ROLES.has(member.role);
    const user = await this.userRepository.findById(userId);
    return !!user?.isSystemAdmin;
  }
}

/** Leaves out what is not news: a ticket from an old email. */
function isNews(change: Change, ticket: Ticket): boolean {
  if (change.event !== MatrixNoticeEvent.TICKET_CREATED) return true;
  const origin = ticket.originDate ?? ticket.createdAt;
  return !origin || Date.now() - origin.getTime() < HISTORICAL_AFTER_MS;
}

/**
 * Whether a room hears of this change: a reply to a ticket nobody owns also reaches rooms that only
 * want those, and one action that assigns and moves the status reaches rooms that want either.
 */
function hears(room: MatrixRoom, change: Change, ticket: Ticket): boolean {
  if (room.events.includes(change.event)) return true;
  switch (change.event) {
    case MatrixNoticeEvent.CUSTOMER_REPLY:
      return !ticket.assigneeId && room.events.includes(MatrixNoticeEvent.UNATTENDED_REPLY);
    case MatrixNoticeEvent.TICKET_ASSIGNED:
      return !!change.statusChange && room.events.includes(MatrixNoticeEvent.STATUS_CHANGED);
    case MatrixNoticeEvent.STATUS_CHANGED:
      return !!change.assigneeChange && room.events.includes(MatrixNoticeEvent.TICKET_ASSIGNED);
    default:
      return false;
  }
}

function move(lang: string, from: string, to: string): string {
  return matrixText(lang, 'move', { from: matrixText(lang, `status.${from}` as never), to: matrixText(lang, `status.${to}` as never) });
}

function nameOf(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}
