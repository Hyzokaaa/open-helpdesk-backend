import { EntityNotFoundError } from '../../../shared/domain/errors';
import { SlaPolicy, Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface UpdateSlaPolicyProps {
  workspaceId: string;
  slaPolicy: SlaPolicy | null;
}

function validatePriorityTargets(targets: Record<string, unknown>): void {
  const validKeys = ['critical', 'high', 'medium', 'low'];
  for (const key of validKeys) {
    const value = targets[key];
    if (value !== null && value !== undefined) {
      if (typeof value !== 'number' || value <= 0) {
        throw new Error(`Invalid SLA target for ${key}: must be a positive number or null`);
      }
    }
  }
}

export class UpdateWorkspaceSlaPolicy {
  constructor(private readonly repository: WorkspaceRepository) {}

  async execute(props: UpdateSlaPolicyProps): Promise<Workspace> {
    if (props.slaPolicy !== null) {
      validatePriorityTargets(props.slaPolicy.firstResponse as any);
      validatePriorityTargets(props.slaPolicy.resolution as any);
    }

    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    workspace.slaPolicy = props.slaPolicy;
    await this.repository.update(workspace);
    return workspace;
  }
}
