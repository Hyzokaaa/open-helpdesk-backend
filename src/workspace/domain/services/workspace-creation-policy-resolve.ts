import { WorkspaceCreationSettingsRepository } from '../repositories/workspace-creation-settings.repository';

export interface WorkspaceCreationPolicy {
  /** Whether any signed-in user may create a workspace. System admins always may. */
  selfService: boolean;
  /** Set by the server environment; the admin panel cannot change it. */
  lockedByEnvironment: boolean;
}

/**
 * Who may create workspaces. The deployment can fix it (an environment setting, e.g. a
 * hosted offering opens it); otherwise the system admin decides, and it is closed by default.
 */
export class ResolveWorkspaceCreationPolicy {
  constructor(
    private readonly repository: WorkspaceCreationSettingsRepository,
    /** The environment's value, or null when it leaves the decision to the admin panel. */
    private readonly environmentSelfService: boolean | null,
  ) {}

  async execute(): Promise<WorkspaceCreationPolicy> {
    if (this.environmentSelfService !== null) {
      return { selfService: this.environmentSelfService, lockedByEnvironment: true };
    }
    const settings = await this.repository.find();
    return { selfService: settings?.selfService ?? false, lockedByEnvironment: false };
  }
}
