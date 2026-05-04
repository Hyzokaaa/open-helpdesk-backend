import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { PaginatedResult } from '../../../../shared/domain/paginated-result';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketCategory } from '../../../domain/enums/ticket-category.enum';
import { TicketPriority } from '../../../domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../domain/enums/ticket-status.enum';
import {
  TicketFilters,
  TicketRepository,
} from '../../../domain/repositories/ticket.repository';
import { TicketModel } from '../models/ticket.model';
import { TagModel } from '../../../../tag/infrastructure/typeorm/models/tag.model';

@Injectable()
export class TypeOrmTicketRepository implements TicketRepository {
  constructor(
    @InjectRepository(TicketModel)
    private readonly repository: Repository<TicketModel>,
  ) {}

  async create(ticket: Ticket): Promise<void> {
    const model = this.toModel(ticket);
    model.tags = ticket.tagIds.map((id) => {
      const tag = new TagModel();
      tag.id = id;
      return tag;
    });
    await this.repository.save(model);
  }

  async findById(id: string): Promise<Ticket | null> {
    const model = await this.repository.findOne({
      where: { id },
      relations: ['tags'],
    });
    return model ? this.toDomain(model) : null;
  }

  async findAll(
    workspaceId: string,
    filters: TicketFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Ticket>> {
    const qb = this.repository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.tags', 'tag')
      .where('ticket.workspaceId = :workspaceId', { workspaceId });

    if (filters.status) {
      qb.andWhere('ticket.status = :status', { status: filters.status });
    }
    if (filters.excludeStatus) {
      qb.andWhere('ticket.status != :excludeStatus', { excludeStatus: filters.excludeStatus });
    }
    if (filters.priority) {
      qb.andWhere('ticket.priority = :priority', {
        priority: filters.priority,
      });
    }
    if (filters.assigneeId) {
      qb.andWhere('ticket.assigneeId = :assigneeId', {
        assigneeId: filters.assigneeId,
      });
    }
    if (filters.creatorId) {
      qb.andWhere('ticket.creatorId = :creatorId', {
        creatorId: filters.creatorId,
      });
    }
    if (filters.tagIds && filters.tagIds.length > 0) {
      qb.andWhere(
        'ticket.id IN ' +
          qb
            .subQuery()
            .select('tt.ticketsId')
            .from('ticket_tag', 'tt')
            .where('tt.tagsId IN (:...tagIds)')
            .getQuery(),
        { tagIds: filters.tagIds },
      );
    }

    const VALID_SORT_FIELDS: Record<string, { col: string; lower: boolean }> = {
      name: { col: 'ticket.name', lower: true },
      priority: { col: 'ticket.priority', lower: false },
      status: { col: 'ticket.status', lower: false },
      category: { col: 'ticket.category', lower: false },
      createdAt: { col: 'ticket.createdAt', lower: false },
    };

    const field = VALID_SORT_FIELDS[filters.sortBy ?? ''] ?? { col: 'ticket.createdAt', lower: false };
    const sortOrder = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const expr = field.lower ? `LOWER(${field.col})` : field.col;
    qb.orderBy(expr, sortOrder);
    qb.skip((page - 1) * limit).take(limit);

    const [models, total] = await qb.getManyAndCount();

    return {
      items: models.map((m) => this.toDomain(m)),
      total,
      page,
      limit,
    };
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  async countByWorkspaceIdSince(workspaceId: string, since: Date): Promise<number> {
    return this.repository.count({
      where: { workspaceId, createdAt: MoreThanOrEqual(since) },
      withDeleted: false,
    });
  }

  async update(ticket: Ticket): Promise<void> {
    const model = this.toModel(ticket);
    model.tags = ticket.tagIds.map((id) => {
      const tag = new TagModel();
      tag.id = id;
      return tag;
    });
    await this.repository.save(model);
  }

  private toDomain(model: TicketModel): Ticket {
    return new Ticket({
      id: model.id,
      name: model.name,
      description: model.description,
      priority: model.priority as TicketPriority,
      status: model.status as TicketStatus,
      category: model.category as TicketCategory,
      workspaceId: model.workspaceId,
      creatorId: model.creatorId,
      assigneeId: model.assigneeId,
      resolvedAt: model.resolvedAt,
      createdAt: model.createdAt,
      deletedAt: model.deletedAt,
      tagIds: model.tags ? model.tags.map((t) => t.id) : [],
      customFields: model.customFields ?? {},
    });
  }

  private toModel(ticket: Ticket): TicketModel {
    const model = new TicketModel();
    model.id = ticket.getId();
    model.name = ticket.name;
    model.description = ticket.description;
    model.priority = ticket.priority;
    model.status = ticket.status;
    model.category = ticket.category;
    model.workspaceId = ticket.workspaceId;
    model.creatorId = ticket.creatorId;
    model.assigneeId = ticket.assigneeId;
    model.resolvedAt = ticket.resolvedAt;
    model.customFields = ticket.customFields;
    return model;
  }
}
