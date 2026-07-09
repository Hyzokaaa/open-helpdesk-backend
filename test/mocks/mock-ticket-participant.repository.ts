import { TicketParticipant } from '../../src/ticket/domain/entities/ticket-participant';
import { ParticipantRole } from '../../src/ticket/domain/enums/participant-role.enum';
import { TicketParticipantRepository } from '../../src/ticket/domain/repositories/ticket-participant.repository';

export class MockTicketParticipantRepository implements TicketParticipantRepository {
  private participants: TicketParticipant[] = [];

  async add(participant: TicketParticipant): Promise<void> {
    this.participants.push(participant);
  }

  async remove(ticketId: string, userId: string): Promise<void> {
    this.participants = this.participants.filter(
      (p) => !(p.ticketId === ticketId && p.userId === userId),
    );
  }

  async findByTicketId(ticketId: string): Promise<TicketParticipant[]> {
    return this.participants.filter((p) => p.ticketId === ticketId);
  }

  async findByUserId(userId: string, role?: ParticipantRole): Promise<TicketParticipant[]> {
    return this.participants.filter(
      (p) => p.userId === userId && (!role || p.role === role),
    );
  }

  async exists(ticketId: string, userId: string): Promise<boolean> {
    return this.participants.some((p) => p.ticketId === ticketId && p.userId === userId);
  }

  async findTicketIdsByUserId(userId: string): Promise<string[]> {
    return this.participants.filter((p) => p.userId === userId).map((p) => p.ticketId);
  }

  seed(participant: TicketParticipant): void {
    this.participants.push(participant);
  }
}
