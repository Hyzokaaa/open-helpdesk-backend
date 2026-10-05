import { WorkspaceCreationSettings } from '../entities/workspace-creation-settings';

export interface WorkspaceCreationSettingsRepository {
  find(): Promise<WorkspaceCreationSettings | null>;
  save(settings: WorkspaceCreationSettings): Promise<void>;
}
