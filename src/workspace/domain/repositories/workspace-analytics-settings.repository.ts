import { WorkspaceAnalyticsSettings } from '../entities/workspace-analytics-settings';

export interface WorkspaceAnalyticsSettingsRepository {
  findByWorkspaceId(workspaceId: string): Promise<WorkspaceAnalyticsSettings | null>;
  save(settings: WorkspaceAnalyticsSettings): Promise<void>;
}
