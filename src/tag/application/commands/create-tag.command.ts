import { Command } from '../../../shared/domain/command';
import { CreateTag } from '../../domain/services/tag-create';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  name: string;
  color: string | null;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CreateTagResponse {
  id: string;
  name: string;
  color: string | null;
}

export class CreateTagCommand implements Command<Props, CreateTagResponse> {
  constructor(
    private readonly createTag: CreateTag,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<CreateTagResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TAG_CREATE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const tag = await this.createTag.execute({
      name: props.name,
      color: props.color,
      workspaceId: props.workspaceId,
    });

    return { id: tag.getId(), name: tag.name, color: tag.color };
  }
}
