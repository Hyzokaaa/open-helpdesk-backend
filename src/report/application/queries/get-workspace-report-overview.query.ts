import { DataSource } from 'typeorm';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  dateFrom: Date | null;
  dateTo: Date | null;
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

  private dateClause(col: string, paramIdx: number, props: Props): { sql: string; params: any[] } {
    if (!props.dateFrom || !props.dateTo) return { sql: '', params: [] };
    return {
      sql: ` AND ${col} >= $${paramIdx} AND ${col} < $${paramIdx + 1}`,
      params: [props.dateFrom, props.dateTo],
    };
  }

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

    const rvDate = this.dateClause('"resolvedAt"', 2, props);
    const [resolvedResult] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE "workspaceId" = $1${rvDate.sql} AND "deletedAt" IS NULL
         AND "discardReason" IS NULL`,
      [props.workspaceId, ...rvDate.params],
    );

    const arDate = this.dateClause('"resolvedAt"', 2, props);
    const [avgResolution] = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600) as avg_hours
       FROM tickets
       WHERE "workspaceId" = $1${arDate.sql} AND "deletedAt" IS NULL
         AND "discardReason" IS NULL`,
      [props.workspaceId, ...arDate.params],
    );

    const frDate = this.dateClause('t."createdAt"', 2, props);
    const [avgFirstResponse] = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (fr.first_response - t."createdAt")) / 3600) as avg_hours
       FROM tickets t
       INNER JOIN LATERAL (
         SELECT MIN(c."createdAt") as first_response
         FROM comments c
         WHERE c."ticketId" = t.id AND c."authorId" != t."reporterId"
       ) fr ON fr.first_response IS NOT NULL
       WHERE t."workspaceId" = $1${frDate.sql} AND t."deletedAt" IS NULL`,
      [props.workspaceId, ...frDate.params],
    );

    return {
      openTickets: parseInt(openResult.count, 10),
      resolvedThisPeriod: parseInt(resolvedResult.count, 10),
      avgResolutionTimeHours: avgResolution.avg_hours ? parseFloat(avgResolution.avg_hours) : null,
      avgFirstResponseTimeHours: avgFirstResponse.avg_hours ? parseFloat(avgFirstResponse.avg_hours) : null,
    };
  }
}
