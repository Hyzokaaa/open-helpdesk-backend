import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { EnsureWorkspaceOwner } from './workspace-ensure-owner';

/** How long a deleted workspace can be restored before it is purged for good. */
export const WORKSPACE_RECOVERY_DAYS = 30;

interface DeleteWorkspaceProps {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  /** The workspace's name, typed by whoever deletes it to confirm. */
  confirmName: string;
  now?: Date;
}

export interface DeletedWorkspace {
  workspace: Workspace;
  purgeAt: Date;
}

/**
 * Deletes a workspace without erasing it: it is off everywhere (no access, no mail, no keys)
 * and can be restored until its purge date, when it is erased with all its data.
 */
export class DeleteWorkspace {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly ensureOwner: EnsureWorkspaceOwner,
  ) {}

  async execute(props: DeleteWorkspaceProps): Promise<DeletedWorkspace> {
    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    await this.ensureOwner.execute({ workspace, userId: props.userId, isSystemAdmin: props.isSystemAdmin });

    if (normalizeName(props.confirmName) !== normalizeName(workspace.name)) {
      throw new DomainValidationError('Type the name of the workspace to confirm');
    }

    const now = props.now ?? new Date();
    const purgeAt = new Date(now.getTime() + WORKSPACE_RECOVERY_DAYS * 24 * 60 * 60 * 1000);
    await this.repository.softDelete(workspace.getId(), props.userId, purgeAt);
    return { workspace, purgeAt };
  }
}

function normalizeName(name: string | null | undefined): string {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
