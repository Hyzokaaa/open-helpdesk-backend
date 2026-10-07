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
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';

@Controller('workspaces/:slug/audit-log')
export class AuditLogController {
  constructor(
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
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
    const result = await query.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      filters: {
        actions: filters.actions,
        entityTypes: filters.entityTypes,
        entityId: filters.entityId,
        categories: filters.categories,
        levels: filters.levels,
        sources: filters.sources,
        userIds: filters.userIds,
        search: filters.search,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        sortOrder: filters.sortOrder,
      },
      page: filters.page,
      limit: filters.limit,
    });

    // Who acted, also when they are no longer a member and the client cannot name them
    const userIds = [...new Set(result.items.map((i) => i.userId).filter(Boolean))] as string[];
    const users = userIds.length > 0 ? await this.userRepository.findByIds(userIds) : [];
    const names = new Map(users.map((u) => [u.getId(), `${u.firstName} ${u.lastName}`.trim() || u.email]));
    return {
      ...result,
      items: result.items.map((item) => ({ ...item, userName: item.userId ? names.get(item.userId) ?? null : null })),
    };
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
