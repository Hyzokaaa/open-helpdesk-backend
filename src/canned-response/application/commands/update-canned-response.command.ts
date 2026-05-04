import { Command } from '../../../shared/domain/command';
import { UpdateCannedResponse } from '../../domain/services/canned-response-update';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  title?: string;
  content?: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface UpdateCannedResponseResponse {
  id: string;
  title: string;
  content: string;
}

export class UpdateCannedResponseCommand implements Command<Props, UpdateCannedResponseResponse> {
  constructor(
    private readonly updateCannedResponse: UpdateCannedResponse,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<UpdateCannedResponseResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.CANNED_RESPONSE_EDIT,
      isSystemAdmin: props.isSystemAdmin,
    });

    const cannedResponse = await this.updateCannedResponse.execute({
      id: props.id,
      title: props.title,
      content: props.content,
    });

    return { id: cannedResponse.getId(), title: cannedResponse.title, content: cannedResponse.content };
  }
}
