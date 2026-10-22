import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Ticket } from '../entities/ticket';
import { TicketReopenReason } from '../enums/ticket-reopen-reason.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { TicketReopen } from '../ticket-reopen';
import { isClosedStatus } from '../ticket-resolution';
import { settleAssignment } from '../ticket-assignment-rule';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

/** The team explains a reopen in at least this many characters, so "no" or "wrong" do not pass. */
export const REOPEN_NOTE_MIN_LENGTH = 20;
/** How long after it was resolved the requester can still reopen it from the portal. */
export const REQUESTER_REOPEN_DAYS = 14;

/** Where the team can send a reopened ticket: the queue, or back to somebody's work. */
export const REOPEN_TARGETS: TicketStatus[] = [TicketStatus.OPEN, TicketStatus.PENDING, TicketStatus.IN_PROGRESS];

const TEAM_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.SUPERVISOR, WorkspaceRole.AGENT];
const TEAM_REASONS = [
  TicketReopenReason.ISSUE_PERSISTS,
  TicketReopenReason.CLOSED_WITHOUT_CONFIRMATION,
  TicketReopenReason.WORK_MISSING,
  TicketReopenReason.OTHER,
];

interface ReopenTicketProps {
  ticketId: string;
  workspaceId: string;
  userId: string;
  /** The requester from the portal, instead of the team. */
  byRequester?: boolean;
  reason: TicketReopenReason;
  note: string;
  /** Who takes it; left out, whoever had it (or resolved it). Only the team chooses. */
  assigneeId?: string | null;
  /** Where it goes back to; left out, In progress. Only the team chooses. */
  status?: TicketStatus;
  now?: Date;
}

export interface ReopenTicketResult {
  ticket: Ticket;
  previousStatus: TicketStatus;
  previousAssigneeId: string | null;
  reopen: TicketReopen;
}

/**
 * Reopens a resolved or discarded ticket: it goes back to In progress (or the status the team
 * chooses) with whoever had it, or to the queue when that person is no longer on the team, as
 * settleAssignment says. Who had resolved it is kept on the ticket
 * (in its last reopen), while the current resolution empties, so reports and SLA count it as open.
 */
export class ReopenTicket {
  constructor(
    private readonly repository: TicketRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
  ) {}

  async execute(props: ReopenTicketProps): Promise<ReopenTicketResult> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Ticket not found');
    if (!isClosedStatus(ticket.status)) throw new DomainValidationError('Only resolved or discarded tickets can be reopened');

    const now = props.now ?? new Date();
    const note = props.note?.trim() ?? '';
    if (props.byRequester) {
      if (ticket.reporterId !== props.userId) throw new AccessDeniedError('Only the requester can reopen it from the portal');
      if (ticket.status !== TicketStatus.RESOLVED || !ticket.resolvedAt) {
        throw new DomainValidationError('Only resolved tickets can be reopened from the portal');
      }
      if (now.getTime() - ticket.resolvedAt.getTime() > REQUESTER_REOPEN_DAYS * 24 * 3600 * 1000) {
        throw new DomainValidationError(`It was resolved more than ${REQUESTER_REOPEN_DAYS} days ago; open a new ticket`);
      }
      if (!note) throw new DomainValidationError('Say what is still wrong');
    } else {
      if (!TEAM_REASONS.includes(props.reason)) throw new DomainValidationError('Choose why it is reopened');
      if (note.length < REOPEN_NOTE_MIN_LENGTH) {
        throw new DomainValidationError(`Explain it in at least ${REOPEN_NOTE_MIN_LENGTH} characters`);
      }
    }

    const target = (!props.byRequester && props.status) || TicketStatus.IN_PROGRESS;
    if (!REOPEN_TARGETS.includes(target)) throw new DomainValidationError('A reopened ticket goes back to open, pending or in-progress');

    const previousStatus = ticket.status;
    const previousAssigneeId = ticket.assigneeId;
    // Back to the queue takes nobody unless asked; back to work takes whoever had it
    const wanted = !props.byRequester && props.assigneeId !== undefined
      ? props.assigneeId
      : target === TicketStatus.OPEN ? null : ticket.assigneeId ?? ticket.resolvedById;
    const assigneeId = wanted && (await this.isOnTeam(ticket.workspaceId, wanted)) ? wanted : null;
    // The queue is checked against who was asked for; work against who can take it
    const status = settleAssignment(target, target === TicketStatus.OPEN ? wanted : assigneeId);

    const reopen: TicketReopen = {
      byId: props.userId,
      at: now.toISOString(),
      reason: props.byRequester ? TicketReopenReason.REQUESTER : props.reason,
      note,
      fromStatus: previousStatus as TicketReopen['fromStatus'],
      previousResolvedById: ticket.resolvedById,
      previousResolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
    };

    ticket.status = status;
    ticket.assigneeId = assigneeId;
    ticket.resolvedAt = null;
    ticket.resolvedById = null;
    ticket.discardReason = null;
    ticket.reopenCount += 1;
    ticket.lastReopen = reopen;

    await this.repository.update(ticket);
    return { ticket, previousStatus, previousAssigneeId, reopen };
  }

  private async isOnTeam(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepository.findByWorkspaceAndUser(workspaceId, userId);
    return !!member && TEAM_ROLES.includes(member.role);
  }
}
