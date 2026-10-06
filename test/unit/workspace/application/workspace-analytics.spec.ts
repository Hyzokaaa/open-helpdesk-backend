import { UpdateWorkspaceAnalyticsCommand } from '../../../../src/workspace/application/commands/update-workspace-analytics.command';
import { GetWorkspaceAnalyticsQuery } from '../../../../src/workspace/application/queries/get-workspace-analytics.query';
import { GetWorkspacePublicAnalyticsQuery } from '../../../../src/workspace/application/queries/get-workspace-public-analytics.query';
import { UpdateWorkspaceAnalyticsSettings } from '../../../../src/workspace/domain/services/workspace-analytics-update';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { hasPermission, PERMISSIONS } from '../../../../src/workspace/domain/permissions';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../src/audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../src/audit-log/domain/enums/audit-category.enum';
import { AnalyticsProvider } from '../../../../src/config/domain/enums/analytics-provider.enum';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceAnalyticsSettingsRepository } from '../../../mocks/mock-workspace-analytics-settings.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { MockAuditLogRepository } from '../../../mocks/mock-audit-log.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

describe('workspace analytics use cases', () => {
  let repository: MockWorkspaceAnalyticsSettingsRepository;
  let members: MockWorkspaceMemberRepository;
  let auditLog: MockAuditLogRepository;
  let update: UpdateWorkspaceAnalyticsCommand;
  let get: GetWorkspaceAnalyticsQuery;
  let getPublic: GetWorkspacePublicAnalyticsQuery;

  const matomo = { provider: AnalyticsProvider.MATOMO, serverUrl: 'https://stats.acme.com/', siteId: '4' };

  beforeEach(() => {
    repository = new MockWorkspaceAnalyticsSettingsRepository();
    members = new MockWorkspaceMemberRepository();
    auditLog = new MockAuditLogRepository();
    const idGenerator = new FakeIdGenerator();
    const ensurePermission = new EnsureWorkspacePermission(members);
    update = new UpdateWorkspaceAnalyticsCommand(
      new UpdateWorkspaceAnalyticsSettings(repository, idGenerator),
      ensurePermission,
      new CreateAuditLogEntry(idGenerator, auditLog),
    );
    get = new GetWorkspaceAnalyticsQuery(repository, ensurePermission);
    getPublic = new GetWorkspacePublicAnalyticsQuery(repository);
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'admin', role: WorkspaceRole.ADMIN }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'supervisor', role: WorkspaceRole.SUPERVISOR }));
  });

  it('grants the permission to workspace admins only', () => {
    expect(hasPermission(WorkspaceRole.ADMIN, PERMISSIONS.WORKSPACE_ANALYTICS_MANAGE)).toBe(true);
    for (const role of [WorkspaceRole.SUPERVISOR, WorkspaceRole.AGENT, WorkspaceRole.USER]) {
      expect(hasPermission(role, PERMISSIONS.WORKSPACE_ANALYTICS_MANAGE)).toBe(false);
    }
  });

  it('returns the defaults when the workspace has no settings', async () => {
    expect(await get.execute({ workspaceId: 'ws-1', userId: 'admin', isSystemAdmin: false })).toEqual({
      provider: null, serverUrl: null, siteId: null, useCookies: false, trackEvents: true, shareWithInstallation: true,
    });
    expect(await getPublic.execute({ workspaceId: 'ws-1' })).toEqual({ analytics: null, shareWithInstallation: true });
  });

  it('lets an admin update and audits before and after in the workspace', async () => {
    const response = await update.execute({ workspaceId: 'ws-1', userId: 'admin', isSystemAdmin: false, ...matomo, shareWithInstallation: false });

    expect(response).toEqual({ ...matomo, useCookies: false, trackEvents: true, shareWithInstallation: false });
    expect(auditLog.entries).toHaveLength(1);
    const [entry] = auditLog.entries;
    expect(entry).toMatchObject({
      action: AuditAction.WORKSPACE_ANALYTICS_UPDATED, workspaceId: 'ws-1', userId: 'admin', category: AuditCategory.WORKSPACE,
    });
    expect(entry.metadata).toEqual({
      before: { provider: null, serverUrl: null, siteId: null, useCookies: false, trackEvents: true, shareWithInstallation: true },
      after: response,
    });
  });

  it('exposes only the public tracker config and the share flag', async () => {
    await update.execute({ workspaceId: 'ws-1', userId: 'admin', isSystemAdmin: false, ...matomo, useCookies: true });

    expect(await getPublic.execute({ workspaceId: 'ws-1' })).toEqual({
      analytics: { provider: AnalyticsProvider.MATOMO, serverUrl: 'https://stats.acme.com/', siteId: '4', useCookies: true, trackEvents: true },
      shareWithInstallation: true,
    });
    expect(await getPublic.execute({ workspaceId: 'ws-other' })).toEqual({ analytics: null, shareWithInstallation: true });
  });

  it('refuses a supervisor and a non-member, and lets a system admin through', async () => {
    for (const userId of ['supervisor', 'stranger']) {
      await expect(update.execute({ workspaceId: 'ws-1', userId, isSystemAdmin: false, ...matomo })).rejects.toThrow(AccessDeniedError);
      await expect(get.execute({ workspaceId: 'ws-1', userId, isSystemAdmin: false })).rejects.toThrow(AccessDeniedError);
    }
    expect(await repository.findByWorkspaceId('ws-1')).toBeNull();
    expect(auditLog.entries).toHaveLength(0);

    await update.execute({ workspaceId: 'ws-1', userId: 'root', isSystemAdmin: true, shareWithInstallation: false });
    expect((await get.execute({ workspaceId: 'ws-1', userId: 'root', isSystemAdmin: true })).shareWithInstallation).toBe(false);
  });
});
