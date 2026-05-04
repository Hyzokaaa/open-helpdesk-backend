import { Query } from '../../../shared/domain/query';
import { CannedResponseRepository } from '../../domain/repositories/canned-response.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CannedResponseListItem {
  id: string;
  title: string;
  content: string;
}

export class ListCannedResponsesQuery implements Query<Props, CannedResponseListItem[]> {
  constructor(
    private readonly repository: CannedResponseRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<CannedResponseListItem[]> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.CANNED_RESPONSE_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const responses = await this.repository.findByWorkspaceId(props.workspaceId);
    return responses.map((r) => ({
      id: r.getId(),
      title: r.title,
      content: r.content,
    }));
  }
}
