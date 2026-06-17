import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { GetWorkspaceReportQuery } from '../../../application/queries/get-workspace-report.query';
import { GetWorkspaceReportOverviewQuery } from '../../../application/queries/get-workspace-report-overview.query';
import { GetUserStatsQuery } from '../../../application/queries/get-user-stats.query';
import { ReportFilterDto } from '../dto/report-filter.dto';

@Controller('workspaces/:slug')
export class ReportController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    private readonly dataSource: DataSource,
  ) {}

  @Get('reports/overview')
  async getReportOverview(
    @Param('slug') slug: string,
    @Query() filters: ReportFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new GetWorkspaceReportOverviewQuery(this.dataSource, ensurePermission);
    return query.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      dateFrom: new Date(filters.dateFrom),
      dateTo: new Date(filters.dateTo),
    });
  }

  @Get('reports')
  async getReport(
    @Param('slug') slug: string,
    @Query() filters: ReportFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new GetWorkspaceReportQuery(this.dataSource, ensurePermission, this.workspaceRepository);
    return query.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      dateFrom: new Date(filters.dateFrom),
      dateTo: new Date(filters.dateTo),
    });
  }

  @Get('stats/me')
  async getMyStats(
    @Param('slug') slug: string,
    @Query() filters: ReportFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new GetUserStatsQuery(this.dataSource, ensurePermission, this.userRepository, this.memberRepository);
    return query.execute({
      workspaceId: workspace.getId(),
      requesterId: user.userId,
      targetUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      dateFrom: new Date(filters.dateFrom),
      dateTo: new Date(filters.dateTo),
    });
  }

  @Get('stats/:userId')
  async getUserStats(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Query() filters: ReportFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new GetUserStatsQuery(this.dataSource, ensurePermission, this.userRepository, this.memberRepository);
    return query.execute({
      workspaceId: workspace.getId(),
      requesterId: user.userId,
      targetUserId: userId,
      isSystemAdmin: user.isSystemAdmin,
      dateFrom: new Date(filters.dateFrom),
      dateTo: new Date(filters.dateTo),
    });
  }
}
