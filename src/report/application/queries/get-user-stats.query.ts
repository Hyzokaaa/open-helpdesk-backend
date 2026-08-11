import { DataSource } from 'typeorm';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

interface Props {
  workspaceId: string;
  requesterId: string;
  targetUserId: string;
  isSystemAdmin: boolean;
  dateFrom: Date | null;
  dateTo: Date | null;
  dateField?: 'received' | 'sent';
}

export interface UserStatsUser {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface UserStatsResult {
  isReporter: boolean;
  user: UserStatsUser | null;
  overview: {
    resolvedTotal: number;
    resolvedPeriod: number;
    totalAssigned: number;
    activeTickets: number;
    avgResolutionTimeHours: number | null;
    avgFirstResponseTimeHours: number | null;
    csatScore: number | null;
    csatResponseCount: number;
    ticketsCreated?: number;
    ticketsResolved?: number;
    ticketsPending?: number;
    csatGiven?: number | null;
  };
  ticketsByStatus: { status: string; count: number }[];
  resolutionTrend: { date: string; resolved: number }[];
}

export class GetUserStatsQuery {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly userRepository: UserRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
  ) {}

  async execute(props: Props): Promise<UserStatsResult> {
    const isSelf = props.requesterId === props.targetUserId;

    if (isSelf) {
      await this.ensurePermission.execute({
        workspaceId: props.workspaceId,
        userId: props.requesterId,
        isSystemAdmin: props.isSystemAdmin,
      });
    } else {
      await this.ensurePermission.execute({
        workspaceId: props.workspaceId,
        userId: props.requesterId,
        permission: PERMISSIONS.REPORT_VIEW,
        isSystemAdmin: props.isSystemAdmin,
      });
    }

    const targetMember = await this.memberRepository.findByWorkspaceAndUser(
      props.workspaceId,
      props.targetUserId,
    );
    const isReporter = targetMember?.role === WorkspaceRole.REPORTER;

    if (isReporter) {
      const [overview, ticketsByStatus, creationTrend, userInfo] = await Promise.all([
        this.getReporterOverview(props),
        this.getReporterTicketsByStatus(props),
        this.getCreationTrend(props),
        isSelf ? Promise.resolve(null) : this.getUserInfo(props.workspaceId, props.targetUserId),
      ]);

      return { isReporter: true, user: userInfo, overview, ticketsByStatus, resolutionTrend: creationTrend };
    }

    const [overview, ticketsByStatus, resolutionTrend, userInfo] = await Promise.all([
      this.getOverview(props),
      this.getTicketsByStatus(props),
      this.getResolutionTrend(props),
      isSelf ? Promise.resolve(null) : this.getUserInfo(props.workspaceId, props.targetUserId),
    ]);

    return { isReporter: false, user: userInfo, overview, ticketsByStatus, resolutionTrend };
  }

  private async getUserInfo(workspaceId: string, userId: string): Promise<UserStatsUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new EntityNotFoundError('User not found');

    const member = await this.memberRepository.findByWorkspaceAndUser(workspaceId, userId);
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: member?.role ?? 'agent',
    };
  }

  private dateClause(col: string, paramIdx: number, props: Props): { sql: string; params: any[] } {
    if (!props.dateFrom || !props.dateTo) return { sql: '', params: [] };
    return {
      sql: ` AND ${col} >= $${paramIdx} AND ${col} < $${paramIdx + 1}`,
      params: [props.dateFrom, props.dateTo],
    };
  }

  private async getOverview(props: Props): Promise<UserStatsResult['overview']> {
    const [resolvedTotal] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE "workspaceId" = $1 AND "resolvedById" = $2 AND "deletedAt" IS NULL
         AND "discardReason" IS NULL`,
      [props.workspaceId, props.targetUserId],
    );

    const rpDate = this.dateClause('"resolvedAt"', 3, props);
    const [resolvedPeriod] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE "workspaceId" = $1 AND "resolvedById" = $2${rpDate.sql} AND "deletedAt" IS NULL
         AND "discardReason" IS NULL`,
      [props.workspaceId, props.targetUserId, ...rpDate.params],
    );

    const [totalAssigned] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE "workspaceId" = $1 AND "assigneeId" = $2 AND "deletedAt" IS NULL`,
      [props.workspaceId, props.targetUserId],
    );

    const [activeTickets] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE "workspaceId" = $1 AND "assigneeId" = $2
         AND status IN ('open', 'pending', 'in-progress') AND "deletedAt" IS NULL`,
      [props.workspaceId, props.targetUserId],
    );

    const arDate = this.dateClause('"resolvedAt"', 3, props);
    const [avgResolution] = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600) as avg_hours
       FROM tickets
       WHERE "workspaceId" = $1 AND "resolvedById" = $2${arDate.sql} AND "deletedAt" IS NULL
         AND "discardReason" IS NULL`,
      [props.workspaceId, props.targetUserId, ...arDate.params],
    );

    const frDate = this.dateClause('t."createdAt"', 3, props);
    const [avgFirstResponse] = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (fr.first_response - t."createdAt")) / 3600) as avg_hours
       FROM tickets t
       INNER JOIN LATERAL (
         SELECT MIN(c."createdAt") as first_response
         FROM comments c
         WHERE c."ticketId" = t.id AND c."authorId" = $2
       ) fr ON fr.first_response IS NOT NULL
       WHERE t."workspaceId" = $1${frDate.sql} AND t."deletedAt" IS NULL`,
      [props.workspaceId, props.targetUserId, ...frDate.params],
    );

    const csDate = this.dateClause('cr."respondedAt"', 3, props);
    const [csatResult] = await this.dataSource.query(
      `SELECT
        AVG(CASE cr.rating WHEN 'good' THEN 100 WHEN 'neutral' THEN 50 WHEN 'bad' THEN 0 END) as score,
        COUNT(*) as total
       FROM csat_responses cr
       INNER JOIN tickets t ON t.id = cr."ticketId"
       WHERE cr."workspaceId" = $1 AND t."resolvedById" = $2${csDate.sql}
         AND cr.rating IS NOT NULL AND t."deletedAt" IS NULL`,
      [props.workspaceId, props.targetUserId, ...csDate.params],
    );

    return {
      resolvedTotal: parseInt(resolvedTotal.count, 10),
      resolvedPeriod: parseInt(resolvedPeriod.count, 10),
      totalAssigned: parseInt(totalAssigned.count, 10),
      activeTickets: parseInt(activeTickets.count, 10),
      avgResolutionTimeHours: avgResolution.avg_hours ? parseFloat(avgResolution.avg_hours) : null,
      avgFirstResponseTimeHours: avgFirstResponse.avg_hours ? parseFloat(avgFirstResponse.avg_hours) : null,
      csatScore: csatResult.score ? parseFloat(csatResult.score) : null,
      csatResponseCount: parseInt(csatResult.total, 10),
    };
  }

  private async getTicketsByStatus(props: Props): Promise<{ status: string; count: number }[]> {
    const rows = await this.dataSource.query(
      `SELECT status, COUNT(*) as count
       FROM tickets
       WHERE "workspaceId" = $1 AND "assigneeId" = $2 AND "deletedAt" IS NULL
       GROUP BY status ORDER BY count DESC`,
      [props.workspaceId, props.targetUserId],
    );

    return rows.map((r: any) => ({ status: r.status, count: parseInt(r.count, 10) }));
  }

  private async getResolutionTrend(props: Props): Promise<{ date: string; resolved: number }[]> {
    const dc = this.dateClause('"resolvedAt"', 3, props);
    const rows = await this.dataSource.query(
      `SELECT DATE("resolvedAt") as date, COUNT(*) as count
       FROM tickets
       WHERE "workspaceId" = $1 AND "resolvedById" = $2${dc.sql}
         AND "deletedAt" IS NULL AND "discardReason" IS NULL
       GROUP BY DATE("resolvedAt") ORDER BY date`,
      [props.workspaceId, props.targetUserId, ...dc.params],
    );

    return rows.map((r: any) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      resolved: parseInt(r.count, 10),
    }));
  }

  private async getReporterOverview(props: Props): Promise<UserStatsResult['overview']> {
    const dateCol = props.dateField === 'sent'
      ? 'COALESCE("originDate", "createdAt")'
      : '"createdAt"';
    const dc = this.dateClause(dateCol, 3, props);

    const [ticketsCreated] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE "workspaceId" = $1 AND "reporterId" = $2${dc.sql} AND "deletedAt" IS NULL`,
      [props.workspaceId, props.targetUserId, ...dc.params],
    );

    const [ticketsResolved] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE "workspaceId" = $1 AND "reporterId" = $2 AND status = 'resolved'${dc.sql}
         AND "deletedAt" IS NULL`,
      [props.workspaceId, props.targetUserId, ...dc.params],
    );

    const [ticketsPending] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE "workspaceId" = $1 AND "reporterId" = $2
         AND status IN ('open', 'pending', 'in-progress')${dc.sql} AND "deletedAt" IS NULL`,
      [props.workspaceId, props.targetUserId, ...dc.params],
    );

    const [avgResolution] = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600) as avg_hours
       FROM tickets
       WHERE "workspaceId" = $1 AND "reporterId" = $2
         AND "resolvedAt" IS NOT NULL${dc.sql} AND "deletedAt" IS NULL`,
      [props.workspaceId, props.targetUserId, ...dc.params],
    );

    const csDate = this.dateClause('cr."respondedAt"', 3, props);
    const [csatResult] = await this.dataSource.query(
      `SELECT
        AVG(CASE cr.rating WHEN 'good' THEN 100 WHEN 'neutral' THEN 50 WHEN 'bad' THEN 0 END) as score,
        COUNT(*) as total
       FROM csat_responses cr
       INNER JOIN tickets t ON t.id = cr."ticketId"
       WHERE cr."workspaceId" = $1 AND t."reporterId" = $2
         AND cr.rating IS NOT NULL${csDate.sql} AND t."deletedAt" IS NULL`,
      [props.workspaceId, props.targetUserId, ...csDate.params],
    );

    return {
      resolvedTotal: 0,
      resolvedPeriod: 0,
      totalAssigned: 0,
      activeTickets: 0,
      avgResolutionTimeHours: avgResolution.avg_hours ? parseFloat(avgResolution.avg_hours) : null,
      avgFirstResponseTimeHours: null,
      csatScore: null,
      csatResponseCount: 0,
      ticketsCreated: parseInt(ticketsCreated.count, 10),
      ticketsResolved: parseInt(ticketsResolved.count, 10),
      ticketsPending: parseInt(ticketsPending.count, 10),
      csatGiven: csatResult.score ? parseFloat(csatResult.score) : null,
    };
  }

  private async getReporterTicketsByStatus(props: Props): Promise<{ status: string; count: number }[]> {
    const rows = await this.dataSource.query(
      `SELECT status, COUNT(*) as count
       FROM tickets
       WHERE "workspaceId" = $1 AND "reporterId" = $2 AND "deletedAt" IS NULL
       GROUP BY status ORDER BY count DESC`,
      [props.workspaceId, props.targetUserId],
    );

    return rows.map((r: any) => ({ status: r.status, count: parseInt(r.count, 10) }));
  }

  private async getCreationTrend(props: Props): Promise<{ date: string; resolved: number }[]> {
    const dateExpr = props.dateField === 'sent'
      ? 'COALESCE("originDate", "createdAt")'
      : '"createdAt"';
    const dc = this.dateClause(dateExpr, 3, props);
    const rows = await this.dataSource.query(
      `SELECT DATE(${dateExpr}) as date, COUNT(*) as count
       FROM tickets
       WHERE "workspaceId" = $1 AND "reporterId" = $2${dc.sql}
         AND "deletedAt" IS NULL
       GROUP BY DATE(${dateExpr}) ORDER BY date`,
      [props.workspaceId, props.targetUserId, ...dc.params],
    );

    return rows.map((r: any) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      resolved: parseInt(r.count, 10),
    }));
  }
}
