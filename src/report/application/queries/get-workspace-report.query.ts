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

export interface ReportResult {
  overview: {
    openTickets: number;
    resolvedThisPeriod: number;
    avgResolutionTimeHours: number | null;
    avgFirstResponseTimeHours: number | null;
    csatScore: number | null;
    csatResponseCount: number;
  };
  ticketsOverTime: { date: string; created: number; resolved: number }[];
  ticketsByStatus: { status: string; count: number }[];
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByCategory: { category: string; count: number }[];
  topAgents: { resolvedById: string; name: string; resolved: number }[];
  csatBreakdown: { rating: string; count: number }[];
}

export class GetWorkspaceReportQuery {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<ReportResult> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.AUDIT_LOG_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const [
      overview,
      ticketsOverTime,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByCategory,
      topAgents,
      csatData,
    ] = await Promise.all([
      this.getOverview(props),
      this.getTicketsOverTime(props),
      this.getTicketsByField(props, 'status'),
      this.getTicketsByField(props, 'priority'),
      this.getTicketsByField(props, 'category'),
      this.getTopAgents(props),
      this.getCsatData(props),
    ]);

    return {
      overview: { ...overview, csatScore: csatData.score, csatResponseCount: csatData.total },
      ticketsOverTime, ticketsByStatus, ticketsByPriority, ticketsByCategory, topAgents,
      csatBreakdown: csatData.breakdown,
    };
  }

  private async getOverview(props: Props) {
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
         WHERE c."ticketId" = t.id AND c."authorId" != t."creatorId"
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

  private async getTicketsOverTime(props: Props) {
    const createdRows = await this.dataSource.query(
      `SELECT DATE("createdAt") as date, COUNT(*) as count
       FROM tickets
       WHERE "workspaceId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3 AND "deletedAt" IS NULL
       GROUP BY DATE("createdAt") ORDER BY date`,
      [props.workspaceId, props.dateFrom, props.dateTo],
    );

    const resolvedRows = await this.dataSource.query(
      `SELECT DATE("resolvedAt") as date, COUNT(*) as count
       FROM tickets
       WHERE "workspaceId" = $1 AND "resolvedAt" >= $2 AND "resolvedAt" < $3 AND "deletedAt" IS NULL
       GROUP BY DATE("resolvedAt") ORDER BY date`,
      [props.workspaceId, props.dateFrom, props.dateTo],
    );

    const dateMap = new Map<string, { created: number; resolved: number }>();

    for (const row of createdRows) {
      const d = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
      dateMap.set(d, { created: parseInt(row.count, 10), resolved: 0 });
    }

    for (const row of resolvedRows) {
      const d = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
      const existing = dateMap.get(d) ?? { created: 0, resolved: 0 };
      existing.resolved = parseInt(row.count, 10);
      dateMap.set(d, existing);
    }

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));
  }

  private async getTicketsByField(props: Props, field: string) {
    const rows = await this.dataSource.query(
      `SELECT "${field}" as value, COUNT(*) as count
       FROM tickets
       WHERE "workspaceId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3 AND "deletedAt" IS NULL
       GROUP BY "${field}" ORDER BY count DESC`,
      [props.workspaceId, props.dateFrom, props.dateTo],
    );

    return rows.map((r: any) => ({ [field]: r.value, count: parseInt(r.count, 10) }));
  }

  private async getTopAgents(props: Props) {
    const rows = await this.dataSource.query(
      `SELECT t."resolvedById", u."firstName" || ' ' || u."lastName" as name, COUNT(*) as resolved
       FROM tickets t
       INNER JOIN users u ON u.id = t."resolvedById"
       WHERE t."workspaceId" = $1 AND t."resolvedAt" >= $2 AND t."resolvedAt" < $3
         AND t."deletedAt" IS NULL AND t."resolvedById" IS NOT NULL
         AND t."discardReason" IS NULL
       GROUP BY t."resolvedById", u."firstName", u."lastName"
       ORDER BY resolved DESC LIMIT 10`,
      [props.workspaceId, props.dateFrom, props.dateTo],
    );

    return rows.map((r: any) => ({
      resolvedById: r.resolvedById,
      name: r.name,
      resolved: parseInt(r.resolved, 10),
    }));
  }

  private async getCsatData(props: Props) {
    const [summary] = await this.dataSource.query(
      `SELECT
        AVG(CASE rating WHEN 'good' THEN 100 WHEN 'neutral' THEN 50 WHEN 'bad' THEN 0 END) as score,
        COUNT(*) as total
       FROM csat_responses
       WHERE "workspaceId" = $1 AND "respondedAt" >= $2 AND "respondedAt" < $3 AND rating IS NOT NULL`,
      [props.workspaceId, props.dateFrom, props.dateTo],
    );

    const breakdownRows = await this.dataSource.query(
      `SELECT rating, COUNT(*) as count
       FROM csat_responses
       WHERE "workspaceId" = $1 AND "respondedAt" >= $2 AND "respondedAt" < $3 AND rating IS NOT NULL
       GROUP BY rating ORDER BY count DESC`,
      [props.workspaceId, props.dateFrom, props.dateTo],
    );

    return {
      score: summary.score ? parseFloat(summary.score) : null,
      total: parseInt(summary.total, 10),
      breakdown: breakdownRows.map((r: any) => ({ rating: r.rating, count: parseInt(r.count, 10) })),
    };
  }
}
