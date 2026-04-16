import { Command } from '../../../shared/domain/command';
import { CreateWorkspace } from '../../domain/services/workspace-create';
import { AddWorkspaceMember } from '../../domain/services/workspace-add-member';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

interface Props {
  name: string;
  description: string;
  dealerId: string | null;
  creatorUserId: string;
}

export interface CreateWorkspaceResponse {
  id: string;
  name: string;
  slug: string;
}

export class CreateWorkspaceCommand implements Command<Props, CreateWorkspaceResponse> {
  constructor(
    private readonly createWorkspace: CreateWorkspace,
    private readonly addMember: AddWorkspaceMember,
  ) {}

  async execute(props: Props): Promise<CreateWorkspaceResponse> {
    const workspace = await this.createWorkspace.execute({
      name: props.name,
      description: props.description,
      dealerId: props.dealerId,
    });

    await this.addMember.execute({
      workspaceId: workspace.getId(),
      userId: props.creatorUserId,
      role: WorkspaceRole.ADMIN,
    });

    return { id: workspace.getId(), name: workspace.name, slug: workspace.slug };
  }
}
