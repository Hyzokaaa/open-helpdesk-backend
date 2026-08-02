import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { ListAuditLogQuery } from '../../../application/queries/list-audit-log.query';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { TypeOrmAuditLogRepository } from '../../typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { AuditLogFilterDto } from '../dto/audit-log-filter.dto';

@Controller('workspaces/:slug/audit-log')
export class AuditLogController {
  constructor(
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
  ) {}

  @Get()
  async list(
    @Param('slug') slug: string,
    @Query() filters: AuditLogFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new ListAuditLogQuery(this.auditLogRepository, ensurePermission);
    return query.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
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
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
