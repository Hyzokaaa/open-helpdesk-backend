import { User } from '../../../user/domain/entities/user';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { TicketRepository } from '../../../ticket/domain/repositories/ticket.repository';
import { TicketParticipantRepository } from '../../../ticket/domain/repositories/ticket-participant.repository';

interface ResolveTicketStakeholdersProps {
  ticketId: string;
  excludeUserId: string;
}

export class ResolveTicketStakeholders {
  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly participantRepository: TicketParticipantRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(props: ResolveTicketStakeholdersProps): Promise<User[]> {
    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket) return [];

    const recipientIds = new Set<string>();
    recipientIds.add(ticket.reporterId);
    if (ticket.assigneeId) recipientIds.add(ticket.assigneeId);

    const participants = await this.participantRepository.findByTicketId(props.ticketId);
    for (const p of participants) recipientIds.add(p.userId);

    recipientIds.delete(props.excludeUserId);

    if (recipientIds.size === 0) return [];
    return this.userRepository.findByIds([...recipientIds]);
  }
}
