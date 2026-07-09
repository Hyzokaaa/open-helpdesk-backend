import { TicketParticipant } from '../entities/ticket-participant';
import { ParticipantRole } from '../enums/participant-role.enum';

export interface TicketParticipantRepository {
  add(participant: TicketParticipant): Promise<void>;
  remove(ticketId: string, userId: string): Promise<void>;
  findByTicketId(ticketId: string): Promise<TicketParticipant[]>;
  findByUserId(userId: string, role?: ParticipantRole): Promise<TicketParticipant[]>;
  exists(ticketId: string, userId: string): Promise<boolean>;
  findTicketIdsByUserId(userId: string): Promise<string[]>;
}
