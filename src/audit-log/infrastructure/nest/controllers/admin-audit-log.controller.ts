import { Controller, Get, Inject, Query } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { ListAllAuditLogQuery } from '../../../application/queries/list-all-audit-log.query';
import { TypeOrmAuditLogRepository } from '../../typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { AuditLogFilterDto } from '../dto/audit-log-filter.dto';

@Controller('admin/audit-log')
export class AdminAuditLogController {
  constructor(
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
  ) {}

  @Get()
  async list(
    @Query() filters: AuditLogFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    const query = new ListAllAuditLogQuery(this.auditLogRepository);
    const result = await query.execute({
      isSystemAdmin: user.isSystemAdmin,
      filters: {
        userId: filters.userId,
        action: filters.action,
        entityType: filters.entityType,
        entityId: filters.entityId,
        category: filters.category,
        level: filters.level,
        source: filters.source,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        sortOrder: filters.sortOrder,
      },
      page: filters.page,
      limit: filters.limit,
    });

    const userIds = [...new Set(result.items.map((i) => i.userId).filter(Boolean))] as string[];
    const userMap = new Map<string, string>();
    for (const uid of userIds) {
      const u = await this.userRepository.findById(uid);
      if (u) userMap.set(uid, `${u.firstName} ${u.lastName}`.trim() || u.email);
    }

    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        userName: item.userId ? userMap.get(item.userId) ?? null : null,
      })),
    };
  }
}
