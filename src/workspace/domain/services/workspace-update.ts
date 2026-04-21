import { AccessDeniedError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface UpdateWorkspaceProps {
  workspaceId: string;
  name?: string;
  description?: string;
  isSystemAdmin: boolean;
}

export class UpdateWorkspace {
  constructor(private readonly repository: WorkspaceRepository) {}

  async execute(props: UpdateWorkspaceProps): Promise<Workspace> {
    if (!props.isSystemAdmin) {
      throw new AccessDeniedError('Only system admins can edit workspaces');
    }

    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    if (props.name !== undefined) workspace.name = props.name;
    if (props.description !== undefined) workspace.description = props.description;

    await this.repository.update(workspace);
    return workspace;
  }
}
