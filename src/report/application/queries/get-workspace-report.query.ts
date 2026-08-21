import { DataSource } from 'typeorm';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  dateFrom: Date | null;
  dateTo: Date | null;
}

export interface ReportResult {
  overview: {
    openTickets: number;
    resolvedThisPeriod: number;
    avgResolutionTimeHours: number | null;
    avgFirstResponseTimeHours: number | null;
    csatScore: number | null;
    csatResponseCount: number;
    slaFirstResponseMet: number | null;
    slaResolutionMet: number | null;
  };
  ticketsOverTime: { date: string; created: number; resolved: number }[];
  ticketsByStatus: { status: string; count: number }[];
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByCategory: { category: string; count: number }[];
  topAgents: { resolvedById: string; name: string; resolved: number }[];
  ticketsByOrganization: { organizationId: string; name: string; count: number }[];
  csatBreakdown: { rating: string; count: number }[];
}

export class GetWorkspaceReportQuery {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly workspaceRepository?: WorkspaceRepository,
  ) {}

  async execute(props: Props): Promise<ReportResult> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.REPORT_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const [
      overview,
      ticketsOverTime,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByCategory,
      topAgents,
      ticketsByOrganization,
      csatData,
      slaMetrics,
    ] = await Promise.all([
      this.getOverview(props),
      this.getTicketsOverTime(props),
      this.getTicketsByField(props, 'status'),
      this.getTicketsByField(props, 'priority'),
      this.getTicketsByField(props, 'category'),
      this.getTopAgents(props),
      this.getTicketsByOrganization(props),
      this.getCsatData(props),
      this.getSlaMetrics(props),
    ]);

    return {
      overview: {
        ...overview,
        csatScore: csatData.score,
        csatResponseCount: csatData.total,
        slaFirstResponseMet: slaMetrics.firstResponseMet,
        slaResolutionMet: slaMetrics.resolutionMet,
      },
      ticketsOverTime, ticketsByStatus, ticketsByPriority, ticketsByCategory, topAgents, ticketsByOrganization,
      csatBreakdown: csatData.breakdown,
    };
  }

  private dateClause(col: string, paramIdx: number, props: Props): { sql: string; params: any[] } {
    if (!props.dateFrom || !props.dateTo) return { sql: '', params: [] };
    return {
      sql: ` AND ${col} >= $${paramIdx} AND ${col} < $${paramIdx + 1}`,
      params: [props.dateFrom, props.dateTo],
    };
  }

  private async getOverview(props: Props) {
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

  private async getTicketsOverTime(props: Props) {
    const crDate = this.dateClause('"createdAt"', 2, props);
    const createdRows = await this.dataSource.query(
      `SELECT DATE("createdAt") as date, COUNT(*) as count
       FROM tickets
       WHERE "workspaceId" = $1${crDate.sql} AND "deletedAt" IS NULL
       GROUP BY DATE("createdAt") ORDER BY date`,
      [props.workspaceId, ...crDate.params],
    );

    const rvDate = this.dateClause('"resolvedAt"', 2, props);
    const resolvedRows = await this.dataSource.query(
      `SELECT DATE("resolvedAt") as date, COUNT(*) as count
       FROM tickets
       WHERE "workspaceId" = $1${rvDate.sql} AND "deletedAt" IS NULL
       GROUP BY DATE("resolvedAt") ORDER BY date`,
      [props.workspaceId, ...rvDate.params],
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
    const dc = this.dateClause('"createdAt"', 2, props);
    const rows = await this.dataSource.query(
      `SELECT "${field}" as value, COUNT(*) as count
       FROM tickets
       WHERE "workspaceId" = $1${dc.sql} AND "deletedAt" IS NULL
       GROUP BY "${field}" ORDER BY count DESC`,
      [props.workspaceId, ...dc.params],
    );

    return rows.map((r: any) => ({ [field]: r.value, count: parseInt(r.count, 10) }));
  }

  private async getTopAgents(props: Props) {
    const dc = this.dateClause('t."resolvedAt"', 2, props);
    const rows = await this.dataSource.query(
      `SELECT t."resolvedById", u."firstName" || ' ' || u."lastName" as name, COUNT(*) as resolved
       FROM tickets t
       INNER JOIN users u ON u.id = t."resolvedById"
       WHERE t."workspaceId" = $1${dc.sql}
         AND t."deletedAt" IS NULL AND t."resolvedById" IS NOT NULL
         AND t."discardReason" IS NULL
       GROUP BY t."resolvedById", u."firstName", u."lastName"
       ORDER BY resolved DESC LIMIT 10`,
      [props.workspaceId, ...dc.params],
    );

    return rows.map((r: any) => ({
      resolvedById: r.resolvedById,
      name: r.name,
      resolved: parseInt(r.resolved, 10),
    }));
  }

  private async getTicketsByOrganization(props: Props) {
    const dc = this.dateClause('t."createdAt"', 2, props);
    const rows = await this.dataSource.query(
      `SELECT o.id as "organizationId", o.name, COUNT(*) as count
       FROM tickets t
       INNER JOIN organizations o ON o.id = t."organizationId" AND o."deletedAt" IS NULL
       WHERE t."workspaceId" = $1${dc.sql} AND t."deletedAt" IS NULL
       GROUP BY o.id, o.name ORDER BY count DESC`,
      [props.workspaceId, ...dc.params],
    );
    return rows.map((r: any) => ({
      organizationId: r.organizationId,
      name: r.name,
      count: parseInt(r.count, 10),
    }));
  }

  private async getCsatData(props: Props) {
    const dc = this.dateClause('"respondedAt"', 2, props);
    const [summary] = await this.dataSource.query(
      `SELECT
        AVG(CASE rating WHEN 'good' THEN 100 WHEN 'neutral' THEN 50 WHEN 'bad' THEN 0 END) as score,
        COUNT(*) as total
       FROM csat_responses
       WHERE "workspaceId" = $1${dc.sql} AND rating IS NOT NULL`,
      [props.workspaceId, ...dc.params],
    );

    const breakdownRows = await this.dataSource.query(
      `SELECT rating, COUNT(*) as count
       FROM csat_responses
       WHERE "workspaceId" = $1${dc.sql} AND rating IS NOT NULL
       GROUP BY rating ORDER BY count DESC`,
      [props.workspaceId, ...dc.params],
    );

    return {
      score: summary.score ? parseFloat(summary.score) : null,
      total: parseInt(summary.total, 10),
      breakdown: breakdownRows.map((r: any) => ({ rating: r.rating, count: parseInt(r.count, 10) })),
    };
  }

  private async getSlaMetrics(props: Props): Promise<{ firstResponseMet: number | null; resolutionMet: number | null }> {
    const workspace = this.workspaceRepository
      ? await this.workspaceRepository.findById(props.workspaceId)
      : null;

    if (!workspace?.slaPolicy) {
      return { firstResponseMet: null, resolutionMet: null };
    }

    const dc = this.dateClause('"createdAt"', 2, props);

    // First response SLA: tickets with firstResponseAt that were NOT breached
    const [frResult] = await this.dataSource.query(
      `SELECT
        COUNT(*) FILTER (WHERE "firstResponseAt" IS NOT NULL) as total,
        COUNT(*) FILTER (WHERE "firstResponseAt" IS NOT NULL AND "firstResponseBreached" = false) as met
       FROM tickets
       WHERE "workspaceId" = $1${dc.sql} AND "deletedAt" IS NULL
         AND "discardReason" IS NULL`,
      [props.workspaceId, ...dc.params],
    );

    // Resolution SLA: resolved tickets that were NOT breached
    const [resResult] = await this.dataSource.query(
      `SELECT
        COUNT(*) FILTER (WHERE "resolvedAt" IS NOT NULL) as total,
        COUNT(*) FILTER (WHERE "resolvedAt" IS NOT NULL AND "resolutionBreached" = false) as met
       FROM tickets
       WHERE "workspaceId" = $1${dc.sql} AND "deletedAt" IS NULL
         AND "discardReason" IS NULL`,
      [props.workspaceId, ...dc.params],
    );

    const frTotal = parseInt(frResult.total, 10);
    const frMet = parseInt(frResult.met, 10);
    const resTotal = parseInt(resResult.total, 10);
    const resMet = parseInt(resResult.met, 10);

    return {
      firstResponseMet: frTotal > 0 ? Math.round((frMet / frTotal) * 100) : null,
      resolutionMet: resTotal > 0 ? Math.round((resMet / resTotal) * 100) : null,
    };
  }
}
