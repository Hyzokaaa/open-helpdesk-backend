import { DataSource } from 'typeorm';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  dateFrom: Date;
  dateTo: Date;
}

export interface ReportOverviewResult {
  openTickets: number;
  resolvedThisPeriod: number;
  avgResolutionTimeHours: number | null;
  avgFirstResponseTimeHours: number | null;
}

export class GetWorkspaceReportOverviewQuery {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<ReportOverviewResult> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.REPORT_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const [openResult] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE "workspaceId" = $1 AND status IN ('open', 'pending', 'in-progress') AND "deletedAt" IS NULL`,
      [props.workspaceId],
    );

    const [resolvedResult] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE "workspaceId" = $1 AND "resolvedAt" >= $2 AND "resolvedAt" < $3 AND "deletedAt" IS NULL
         AND "discardReason" IS NULL`,
      [props.workspaceId, props.dateFrom, props.dateTo],
    );

    const [avgResolution] = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600) as avg_hours
       FROM tickets
       WHERE "workspaceId" = $1 AND "resolvedAt" >= $2 AND "resolvedAt" < $3 AND "deletedAt" IS NULL
         AND "discardReason" IS NULL`,
      [props.workspaceId, props.dateFrom, props.dateTo],
    );

    const [avgFirstResponse] = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (fr.first_response - t."createdAt")) / 3600) as avg_hours
       FROM tickets t
       INNER JOIN LATERAL (
         SELECT MIN(c."createdAt") as first_response
         FROM comments c
         WHERE c."ticketId" = t.id AND c."authorId" != t."reporterId"
       ) fr ON fr.first_response IS NOT NULL
       WHERE t."workspaceId" = $1 AND t."createdAt" >= $2 AND t."createdAt" < $3 AND t."deletedAt" IS NULL`,
      [props.workspaceId, props.dateFrom, props.dateTo],
    );

    return {
      openTickets: parseInt(openResult.count, 10),
      resolvedThisPeriod: parseInt(resolvedResult.count, 10),
      avgResolutionTimeHours: avgResolution.avg_hours ? parseFloat(avgResolution.avg_hours) : null,
      avgFirstResponseTimeHours: avgFirstResponse.avg_hours ? parseFloat(avgFirstResponse.avg_hours) : null,
    };
  }
}
