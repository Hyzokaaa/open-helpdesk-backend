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
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { GetWorkspaceReportQuery } from '../../../application/queries/get-workspace-report.query';
import { ReportFilterDto } from '../dto/report-filter.dto';

@Controller('workspaces/:slug/reports')
export class ReportController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
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
}
