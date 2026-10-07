import { EntityNotFoundError } from '../../../shared/domain/errors';
import { StorageService } from '../../../shared/domain/storage-service';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceFileKeys } from '../workspace-file-keys';

interface PurgeWorkspaceProps {
  workspaceId: string;
}

export interface PurgedWorkspace {
  workspace: Workspace;
  filesDeleted: number;
}

/**
 * Erases a deleted workspace for good: its rows go with the database cascade, and its files are
 * removed from storage, which the cascade cannot reach. Only a deleted workspace is ever purged.
 */
export class PurgeWorkspace {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly fileKeys: WorkspaceFileKeys,
    private readonly storage: StorageService,
  ) {}

  async execute(props: PurgeWorkspaceProps): Promise<PurgedWorkspace> {
    const workspace = await this.repository.findDeletedById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Deleted workspace not found');

    // Read before the rows that name the files are gone
    const keys = [
      ...(await this.fileKeys.listFor(workspace.getId())),
      ...[workspace.logo, workspace.icon].filter((k): k is string => !!k),
    ];

    await this.repository.delete(workspace.getId());

    let filesDeleted = 0;
    for (const key of keys) {
      try {
        await this.storage.delete(key);
        filesDeleted++;
      } catch {
        // A file already missing is not a reason to stop: the workspace is gone either way
      }
    }
    return { workspace, filesDeleted };
  }
}
