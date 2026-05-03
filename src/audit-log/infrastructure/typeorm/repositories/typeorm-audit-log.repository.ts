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

    if (filters.userId) {
      qb.andWhere('audit.userId = :userId', { userId: filters.userId });
    }
    if (filters.action) {
      qb.andWhere('audit.action = :action', { action: filters.action });
    }
    if (filters.entityType) {
      qb.andWhere('audit.entityType = :entityType', { entityType: filters.entityType });
    }
    if (filters.entityId) {
      qb.andWhere('audit.entityId = :entityId', { entityId: filters.entityId });
    }
    if (filters.dateFrom) {
      qb.andWhere('audit.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('audit.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }

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

  private toDomain(model: AuditLogEntryModel): AuditLogEntry {
    return new AuditLogEntry({
      id: model.id,
      action: model.action,
      entityType: model.entityType,
      entityId: model.entityId,
      userId: model.userId,
      workspaceId: model.workspaceId,
      metadata: model.metadata,
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
    return model;
  }
}
