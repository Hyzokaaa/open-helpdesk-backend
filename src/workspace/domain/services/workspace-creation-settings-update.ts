import { ConflictError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { WorkspaceCreationSettings } from '../entities/workspace-creation-settings';
import { WorkspaceCreationSettingsRepository } from '../repositories/workspace-creation-settings.repository';
import { ResolveWorkspaceCreationPolicy, WorkspaceCreationPolicy } from './workspace-creation-policy-resolve';

interface UpdateWorkspaceCreationSettingsProps {
  selfService: boolean;
}

export class UpdateWorkspaceCreationSettings {
  constructor(
    private readonly repository: WorkspaceCreationSettingsRepository,
    private readonly idGenerator: IdGenerator,
    private readonly resolvePolicy: ResolveWorkspaceCreationPolicy,
  ) {}

  async execute(props: UpdateWorkspaceCreationSettingsProps): Promise<WorkspaceCreationPolicy> {
    const current = await this.resolvePolicy.execute();
    if (current.lockedByEnvironment) {
      throw new ConflictError('Workspace creation is set by the server environment (WORKSPACE_SELF_SERVICE)');
    }

    const settings = (await this.repository.find())
      ?? new WorkspaceCreationSettings({ id: this.idGenerator.create(), selfService: false });
    settings.selfService = props.selfService;
    await this.repository.save(settings);

    return this.resolvePolicy.execute();
  }
}
