import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { EnsureWorkspaceOwner } from './workspace-ensure-owner';

interface RestoreWorkspaceProps {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

/** Brings a deleted workspace back exactly as it was, while it has not been purged. */
export class RestoreWorkspace {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly ensureOwner: EnsureWorkspaceOwner,
  ) {}

  async execute(props: RestoreWorkspaceProps): Promise<Workspace> {
    const deleted = await this.repository.findDeletedById(props.workspaceId);
    if (!deleted) throw new EntityNotFoundError('Deleted workspace not found');

    await this.ensureOwner.execute({ workspace: deleted, userId: props.userId, isSystemAdmin: props.isSystemAdmin });

    await this.repository.restore(deleted.getId());
    const restored = await this.repository.findById(deleted.getId());
    if (!restored) throw new EntityNotFoundError('Workspace not found');
    return restored;
  }
}
