import { AccessDeniedError, EntityNotFoundError } from '../../../shared/domain/errors';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface DeleteWorkspaceProps {
  workspaceId: string;
  isSystemAdmin: boolean;
}

export class DeleteWorkspace {
  constructor(private readonly repository: WorkspaceRepository) {}

  async execute(props: DeleteWorkspaceProps): Promise<void> {
    if (!props.isSystemAdmin) {
      throw new AccessDeniedError('Only system admins can delete workspaces');
    }

    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    await this.repository.delete(props.workspaceId);
  }
}
