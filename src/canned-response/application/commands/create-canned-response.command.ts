import { Command } from '../../../shared/domain/command';
import { CreateCannedResponse } from '../../domain/services/canned-response-create';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  title: string;
  content: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CreateCannedResponseResponse {
  id: string;
  title: string;
  content: string;
}

export class CreateCannedResponseCommand implements Command<Props, CreateCannedResponseResponse> {
  constructor(
    private readonly createCannedResponse: CreateCannedResponse,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<CreateCannedResponseResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.CANNED_RESPONSE_CREATE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const cannedResponse = await this.createCannedResponse.execute({
      title: props.title,
      content: props.content,
      workspaceId: props.workspaceId,
    });

    return { id: cannedResponse.getId(), title: cannedResponse.title, content: cannedResponse.content };
  }
}
