import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../../../shared/domain/paginated-result';
import { AuditLogEntry } from '../../../domain/entities/audit-log-entry';
import {
  AuditLogFilters,
  AuditLogRepository,
} from '../../../domain/repositories/audit-log.repository';
import { AuditLogEntryModel } from '../models/audit-log-entry.model';

@Injectable()
export class TypeOrmAuditLogRepository implements AuditLogRepository {
  constructor(
    @InjectRepository(AuditLogEntryModel)
    private readonly repository: Repository<AuditLogEntryModel>,
  ) {}

  async create(entry: AuditLogEntry): Promise<void> {
    await this.repository.save(this.toModel(entry));
  }

  async findAll(
    workspaceId: string | null,
    filters: AuditLogFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<AuditLogEntry>> {
    const qb = this.repository.createQueryBuilder('audit');

    if (workspaceId) {
      qb.where('audit.workspaceId = :workspaceId', { workspaceId });
    } else {
      qb.where('audit.workspaceId IS NULL');
    }

    this.applyFilters(qb, filters);

    const sortOrder = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('audit.createdAt', sortOrder);
    qb.skip((page - 1) * limit).take(limit);

    const [models, total] = await qb.getManyAndCount();

    return {
      items: models.map((m) => this.toDomain(m)),
      total,
      page,
      limit,
    };
  }

  async findAllUnscoped(
    filters: AuditLogFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<AuditLogEntry>> {
    const qb = this.repository.createQueryBuilder('audit');

    this.applyFilters(qb, filters);

    const sortOrder = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('audit.createdAt', sortOrder);
    qb.skip((page - 1) * limit).take(limit);

    const [models, total] = await qb.getManyAndCount();

    return {
      items: models.map((m) => this.toDomain(m)),
      total,
      page,
      limit,
    };
  }

  private applyFilters(qb: ReturnType<Repository<AuditLogEntryModel>['createQueryBuilder']>, filters: AuditLogFilters): void {
    if (filters.actions?.length) {
      qb.andWhere('audit.action IN (:...actions)', { actions: filters.actions });
    }
    if (filters.entityTypes?.length) {
      qb.andWhere('audit.entityType IN (:...entityTypes)', { entityTypes: filters.entityTypes });
    }
    if (filters.entityId) {
      qb.andWhere('audit.entityId = :entityId', { entityId: filters.entityId });
    }
    if (filters.categories?.length) {
      qb.andWhere('audit.category IN (:...categories)', { categories: filters.categories });
    }
    if (filters.levels?.length) {
      qb.andWhere('audit.level IN (:...levels)', { levels: filters.levels });
    }
    if (filters.sources?.length) {
      qb.andWhere('audit.source IN (:...sources)', { sources: filters.sources });
    }
    if (filters.userIds?.length) {
      qb.andWhere('audit.userId IN (:...userIds)', { userIds: filters.userIds });
    }
    if (filters.dateFrom) {
      qb.andWhere('audit.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('audit.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }
  }

  private toDomain(model: AuditLogEntryModel): AuditLogEntry {
    return new AuditLogEntry({
      id: model.id,
      action: model.action,
      entityType: model.entityType,
      entityId: model.entityId,
      userId: model.userId,
      workspaceId: model.workspaceId,
      metadata: model.metadata,
      category: model.category,
      level: model.level,
      source: model.source,
      createdAt: model.createdAt,
    });
  }

  private toModel(entry: AuditLogEntry): AuditLogEntryModel {
    const model = new AuditLogEntryModel();
    model.id = entry.getId();
    model.action = entry.action;
    model.entityType = entry.entityType;
    model.entityId = entry.entityId;
    model.userId = entry.userId;
    model.workspaceId = entry.workspaceId;
    model.metadata = entry.metadata;
    model.category = entry.category;
    model.level = entry.level;
    model.source = entry.source;
    return model;
  }
}
