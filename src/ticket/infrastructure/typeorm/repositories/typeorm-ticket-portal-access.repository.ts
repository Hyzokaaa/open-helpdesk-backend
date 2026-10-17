import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TicketPortalAccess } from '../../../domain/entities/ticket-portal-access';
import { TicketPortalAccessRepository } from '../../../domain/repositories/ticket-portal-access.repository';
import { TicketPortalAccessModel } from '../models/ticket-portal-access.model';

@Injectable()
export class TypeOrmTicketPortalAccessRepository implements TicketPortalAccessRepository {
  constructor(
    @InjectRepository(TicketPortalAccessModel)
    private readonly repository: Repository<TicketPortalAccessModel>,
  ) {}

  async create(access: TicketPortalAccess): Promise<void> {
    await this.repository.insert({
      id: access.getId(),
      ticketId: access.ticketId,
      userId: access.userId,
      token: access.token,
    });
  }

  async findByToken(token: string): Promise<TicketPortalAccess | null> {
    const row = await this.repository.findOneBy({ token });
    return row ? this.toDomain(row) : null;
  }

  async findByTicketAndUser(ticketId: string, userId: string): Promise<TicketPortalAccess | null> {
    const row = await this.repository.findOneBy({ ticketId, userId });
    return row ? this.toDomain(row) : null;
  }

  async findByTicketIds(ticketIds: string[]): Promise<TicketPortalAccess[]> {
    if (ticketIds.length === 0) return [];
    const rows = await this.repository.find({ where: { ticketId: In(ticketIds) } });
    return rows.map((r) => this.toDomain(r));
  }

  async remove(ticketId: string, userId: string): Promise<void> {
    await this.repository.delete({ ticketId, userId });
  }

  async removeByUserInWorkspace(userId: string, workspaceId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .where('"userId" = :userId', { userId })
      .andWhere('"ticketId" IN (SELECT id FROM tickets WHERE "workspaceId" = :workspaceId)', { workspaceId })
      .execute();
  }

  private toDomain(row: TicketPortalAccessModel): TicketPortalAccess {
    return new TicketPortalAccess({ id: row.id, ticketId: row.ticketId, userId: row.userId, token: row.token });
  }
}
