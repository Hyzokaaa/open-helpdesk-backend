import { Command } from '../../../shared/domain/command';
import { UpdateWorkspace } from '../../domain/services/workspace-update';

interface Props {
  workspaceId: string;
  name?: string;
  description?: string;
  isSystemAdmin: boolean;
}

export interface UpdateWorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export class UpdateWorkspaceCommand implements Command<Props, UpdateWorkspaceResponse> {
  constructor(private readonly updateWorkspace: UpdateWorkspace) {}

  async execute(props: Props): Promise<UpdateWorkspaceResponse> {
    const workspace = await this.updateWorkspace.execute(props);
    return {
      id: workspace.getId(),
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
    };
  }
}
