import { Request } from 'express';
import { DataSource } from 'typeorm';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { AccessDeniedRecorder } from '../../../shared/nest/filters/domain-exception.filter';
import { AuthUser } from '../../../shared/nest/strategies/jwt.strategy';
import { clientInfo } from '../../../shared/nest/client-info';
import { UlidGenerator } from '../../../shared/infrastructure/ulid-generator';
import { WorkspaceModel } from '../../../workspace/infrastructure/typeorm/models/workspace.model';
import { CreateAuditLogEntry } from '../../domain/services/audit-log-create';
import { AuditAction } from '../../domain/enums/audit-action.enum';
import { AuditCategory } from '../../domain/enums/audit-category.enum';
import { AuditLevel } from '../../domain/enums/audit-level.enum';
import { AuditLogEntryModel } from '../typeorm/models/audit-log-entry.model';
import { TypeOrmAuditLogRepository } from '../typeorm/repositories/typeorm-audit-log.repository';

/**
 * Records every request refused for lack of permission. In normal use the interface hides what a
 * person cannot do, so a refusal usually means someone is trying things by hand. The route is
 * kept as its pattern (`/workspaces/:slug/tickets/:id`), and the entry lands in the workspace
 * the route names, so its admins see it too.
 */
export class AccessDeniedAuditRecorder implements AccessDeniedRecorder {
  private readonly createEntry: CreateAuditLogEntry;

  constructor(private readonly dataSource: DataSource) {
    this.createEntry = new CreateAuditLogEntry(
      new UlidGenerator(),
      new TypeOrmAuditLogRepository(dataSource.getRepository(AuditLogEntryModel)),
    );
  }

  async record(error: AccessDeniedError, request: Request): Promise<void> {
    const user = request.user as AuthUser | undefined;
    const route = (request.route?.path as string | undefined) ?? request.path;
    const workspaceId = user?.workspaceId ?? (await this.workspaceIdFor(request.params?.slug));

    await this.createEntry.execute({
      action: AuditAction.PERMISSION_DENIED,
      entityType: 'route',
      entityId: `${request.method} ${route}`,
      userId: user?.userId ?? null,
      workspaceId,
      metadata: {
        method: request.method,
        route,
        reason: error.message,
        ...(user?.apiKeyId ? { apiKeyId: user.apiKeyId } : {}),
        client: clientInfo(request),
      },
      category: AuditCategory.SECURITY,
      level: AuditLevel.WARNING,
      source: user?.apiKeyId ? 'api' : 'ui',
    });
  }

  private async workspaceIdFor(slug: unknown): Promise<string | null> {
    if (typeof slug !== 'string' || !slug) return null;
    const workspace = await this.dataSource.getRepository(WorkspaceModel).findOne({ where: { slug }, select: { id: true } });
    return workspace?.id ?? null;
  }
}
