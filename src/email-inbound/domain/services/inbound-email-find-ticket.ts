import { Ticket } from '../../../ticket/domain/entities/ticket';
import { TicketRepository } from '../../../ticket/domain/repositories/ticket.repository';
import { TicketParticipantRepository } from '../../../ticket/domain/repositories/ticket-participant.repository';
import { CommentRepository } from '../../../comment/domain/repositories/comment.repository';
import { ThreadIds } from '../../../email/domain/ticket-email-thread';

interface FindRepliedTicketProps {
  thread: ThreadIds;
  subject: string;
  workspaceId: string;
  /** Who wrote the email, already resolved to a user. */
  senderId: string;
}

/** A reference as people write it in a subject: prefix, dash, counter or code (TK-000042, ACME-7QX4M2K). */
const SUBJECT_REFERENCE = /\b([A-Z0-9]{1,10}-[A-Z0-9]{3,12})\b/gi;

/**
 * The ticket an inbound email replies to, or null when it starts a new conversation.
 *
 * Mail clients carry the thread in In-Reply-To and References, so the ids of the ticket or of
 * the comment that was answered find it first. Some clients or forwards drop those headers;
 * then the reference in the subject is used, but only when the sender takes part in that
 * ticket, so writing someone else's reference in a subject never adds to their ticket.
 */
export class FindRepliedTicket {
  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly commentRepository?: CommentRepository,
    private readonly participantRepository?: TicketParticipantRepository,
  ) {}

  async execute(props: FindRepliedTicketProps): Promise<Ticket | null> {
    const inWorkspace = (ticket: Ticket | null) => (ticket && ticket.workspaceId === props.workspaceId ? ticket : null);

    for (const id of props.thread.ticketIds) {
      const ticket = inWorkspace(await this.ticketRepository.findById(id));
      if (ticket) return ticket;
    }

    if (this.commentRepository) {
      for (const id of props.thread.commentIds) {
        const comment = await this.commentRepository.findById(id);
        const ticket = comment ? inWorkspace(await this.ticketRepository.findById(comment.ticketId)) : null;
        if (ticket) return ticket;
      }
    }

    for (const [, reference] of props.subject.matchAll(SUBJECT_REFERENCE)) {
      const ticket = await this.ticketRepository.findByReference(props.workspaceId, reference.toUpperCase());
      if (ticket && (await this.takesPart(ticket, props.senderId))) return ticket;
    }
    return null;
  }

  private async takesPart(ticket: Ticket, userId: string): Promise<boolean> {
    if (ticket.reporterId === userId || ticket.assigneeId === userId) return true;
    if (!this.participantRepository) return false;
    const participants = await this.participantRepository.findByTicketId(ticket.getId());
    return participants.some((p) => p.userId === userId);
  }
}
