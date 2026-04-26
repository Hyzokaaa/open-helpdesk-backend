import { Command } from '../../../shared/domain/command';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { CreateWorkspace } from '../../domain/services/workspace-create';
import { AddWorkspaceMember } from '../../domain/services/workspace-add-member';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

interface Props {
  name: string;
  description: string;
  creatorUserId: string;
  isSystemAdmin: boolean;
  accountId?: string;
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
    if (!props.isSystemAdmin) {
      throw new AccessDeniedError('Only system admins can create workspaces');
    }

    const workspace = await this.createWorkspace.execute({
      name: props.name,
      description: props.description,
      accountId: props.accountId,
    });

    await this.addMember.execute({
      workspaceId: workspace.getId(),
      userId: props.creatorUserId,
      role: WorkspaceRole.ADMIN,
    });

    return { id: workspace.getId(), name: workspace.name, slug: workspace.slug };
  }
}
