import { IdGenerator } from '../../../shared/domain/id-generator';
import { TicketParticipant } from '../entities/ticket-participant';
import { ParticipantRole } from '../enums/participant-role.enum';
import { TicketParticipantRepository } from '../repositories/ticket-participant.repository';

interface AddParticipantProps {
  ticketId: string;
  userId: string;
  role: ParticipantRole;
}

export class AddTicketParticipant {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: TicketParticipantRepository,
  ) {}

  async execute(props: AddParticipantProps): Promise<TicketParticipant | null> {
    const already = await this.repository.exists(props.ticketId, props.userId);
    if (already) return null;

    const participant = new TicketParticipant({
      id: this.idGenerator.create(),
      ticketId: props.ticketId,
      userId: props.userId,
      role: props.role,
    });

    await this.repository.add(participant);
    return participant;
  }
}
