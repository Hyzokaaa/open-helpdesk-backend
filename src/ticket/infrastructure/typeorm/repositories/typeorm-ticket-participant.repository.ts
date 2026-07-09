import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketParticipant } from '../../../domain/entities/ticket-participant';
import { ParticipantRole } from '../../../domain/enums/participant-role.enum';
import { TicketParticipantRepository } from '../../../domain/repositories/ticket-participant.repository';
import { TicketParticipantModel } from '../models/ticket-participant.model';

@Injectable()
export class TypeOrmTicketParticipantRepository implements TicketParticipantRepository {
  constructor(
    @InjectRepository(TicketParticipantModel)
    private readonly repository: Repository<TicketParticipantModel>,
  ) {}

  async add(participant: TicketParticipant): Promise<void> {
    await this.repository.save({
      id: participant.getId(),
      ticketId: participant.ticketId,
      userId: participant.userId,
      role: participant.role,
    });
  }

  async remove(ticketId: string, userId: string): Promise<void> {
    await this.repository.delete({ ticketId, userId });
  }

  async findByTicketId(ticketId: string): Promise<TicketParticipant[]> {
    const rows = await this.repository.find({ where: { ticketId } });
    return rows.map((r) => new TicketParticipant({
      id: r.id,
      ticketId: r.ticketId,
      userId: r.userId,
      role: r.role as ParticipantRole,
    }));
  }

  async findByUserId(userId: string, role?: ParticipantRole): Promise<TicketParticipant[]> {
    const where: any = { userId };
    if (role) where.role = role;
    const rows = await this.repository.find({ where });
    return rows.map((r) => new TicketParticipant({
      id: r.id,
      ticketId: r.ticketId,
      userId: r.userId,
      role: r.role as ParticipantRole,
    }));
  }

  async exists(ticketId: string, userId: string): Promise<boolean> {
    return await this.repository.exists({ where: { ticketId, userId } });
  }

  async findTicketIdsByUserId(userId: string): Promise<string[]> {
    const rows = await this.repository.find({
      where: { userId },
      select: ['ticketId'],
    });
    return rows.map((r) => r.ticketId);
  }
}
