import { WorkspaceAnalyticsSettings } from '../../src/workspace/domain/entities/workspace-analytics-settings';
import { WorkspaceAnalyticsSettingsRepository } from '../../src/workspace/domain/repositories/workspace-analytics-settings.repository';

export class MockWorkspaceAnalyticsSettingsRepository implements WorkspaceAnalyticsSettingsRepository {
  private readonly rows = new Map<string, WorkspaceAnalyticsSettings>();

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceAnalyticsSettings | null> {
    const row = this.rows.get(workspaceId);
    return row ? this.copy(row) : null;
  }

  async save(settings: WorkspaceAnalyticsSettings): Promise<void> {
    this.rows.set(settings.workspaceId, this.copy(settings));
  }

  private copy(settings: WorkspaceAnalyticsSettings): WorkspaceAnalyticsSettings {
    return new WorkspaceAnalyticsSettings({
      id: settings.getId(),
      workspaceId: settings.workspaceId,
      provider: settings.provider,
      serverUrl: settings.serverUrl,
      siteId: settings.siteId,
      useCookies: settings.useCookies,
      trackEvents: settings.trackEvents,
      shareWithInstallation: settings.shareWithInstallation,
    });
  }
}
