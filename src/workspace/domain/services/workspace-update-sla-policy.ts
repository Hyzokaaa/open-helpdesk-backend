import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { SlaPolicy, SlaPriorityTargets, Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface UpdateSlaPolicyProps {
  workspaceId: string;
  slaPolicy: SlaPolicy | null;
}

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

/**
 * One set of targets, rebuilt from the known priorities only: a malformed body is a 400, and
 * nothing else the request carried is stored with the policy.
 */
function normalizeTargets(targets: unknown, name: string): SlaPriorityTargets {
  if (!targets || typeof targets !== 'object' || Array.isArray(targets)) {
    throw new DomainValidationError(`SLA ${name} targets are required`);
  }
  const source = targets as Record<string, unknown>;
  const result: SlaPriorityTargets = { critical: null, high: null, medium: null, low: null };
  for (const key of PRIORITIES) {
    const value = source[key];
    if (value === null || value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new DomainValidationError(`Invalid SLA target for ${key}: must be a positive number or null`);
    }
    result[key] = value;
  }
  return result;
}

export class UpdateWorkspaceSlaPolicy {
  constructor(private readonly repository: WorkspaceRepository) {}

  async execute(props: UpdateSlaPolicyProps): Promise<Workspace> {
    const slaPolicy: SlaPolicy | null = props.slaPolicy === null
      ? null
      : {
          firstResponse: normalizeTargets(props.slaPolicy?.firstResponse, 'first response'),
          resolution: normalizeTargets(props.slaPolicy?.resolution, 'resolution'),
        };

    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    workspace.slaPolicy = slaPolicy;
    await this.repository.update(workspace);
    return workspace;
  }
}
