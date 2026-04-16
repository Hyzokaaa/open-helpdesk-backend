import { Query } from '../../../shared/domain/query';
import { TagRepository } from '../../domain/repositories/tag.repository';

interface Props {
  workspaceId: string;
}

export interface TagListItem {
  id: string;
  name: string;
  color: string | null;
}

export class ListTagsQuery implements Query<Props, TagListItem[]> {
  constructor(private readonly repository: TagRepository) {}

  async execute(props: Props): Promise<TagListItem[]> {
    const tags = await this.repository.findByWorkspaceId(props.workspaceId);
    return tags.map((tag) => ({
      id: tag.getId(),
      name: tag.name,
      color: tag.color,
    }));
  }
}
