import { Command } from '../../../shared/domain/command';
import { DeleteCannedResponse } from '../../domain/services/canned-response-delete';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export class DeleteCannedResponseCommand implements Command<Props, void> {
  constructor(
    private readonly deleteCannedResponse: DeleteCannedResponse,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.CANNED_RESPONSE_DELETE,
      isSystemAdmin: props.isSystemAdmin,
    });

    await this.deleteCannedResponse.execute({ id: props.id });
  }
}
