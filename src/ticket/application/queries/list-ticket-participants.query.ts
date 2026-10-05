import { Query } from '../../../shared/domain/query';
import { TicketParticipantRepository } from '../../domain/repositories/ticket-participant.repository';
import { EnsureTicketAccess } from '../../domain/services/ticket-ensure-access';
import { UserRepository } from '../../../user/domain/repositories/user.repository';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface TicketParticipantResponse {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export class ListTicketParticipantsQuery implements Query<Props, TicketParticipantResponse[]> {
  constructor(
    private readonly participantRepository: TicketParticipantRepository,
    private readonly userRepository: UserRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
  ) {}

  async execute(props: Props): Promise<TicketParticipantResponse[]> {
    await this.ensureTicketAccess.execute(props);

    const participants = await this.participantRepository.findByTicketId(props.ticketId);
    if (participants.length === 0) return [];

    const users = await this.userRepository.findByIds(participants.map((p) => p.userId));
    const byId = new Map(users.map((u) => [u.getId(), u]));

    const result: TicketParticipantResponse[] = [];
    for (const p of participants) {
      const u = byId.get(p.userId);
      if (!u) continue;
      result.push({
        id: p.getId(),
        userId: p.userId,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: p.role,
      });
    }
    return result;
  }
}
