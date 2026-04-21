import { Query } from '../../../shared/domain/query';
import { TagRepository } from '../../domain/repositories/tag.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface TagListItem {
  id: string;
  name: string;
  color: string | null;
}

export class ListTagsQuery implements Query<Props, TagListItem[]> {
  constructor(
    private readonly repository: TagRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<TagListItem[]> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TAG_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const tags = await this.repository.findByWorkspaceId(props.workspaceId);
    return tags.map((tag) => ({
      id: tag.getId(),
      name: tag.name,
      color: tag.color,
    }));
  }
}
