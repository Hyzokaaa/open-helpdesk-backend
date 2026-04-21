import { Command } from '../../../shared/domain/command';
import { DeleteTag } from '../../domain/services/tag-delete';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export class DeleteTagCommand implements Command<Props, void> {
  constructor(
    private readonly deleteTag: DeleteTag,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TAG_DELETE,
      isSystemAdmin: props.isSystemAdmin,
    });

    await this.deleteTag.execute({ id: props.id });
  }
}
