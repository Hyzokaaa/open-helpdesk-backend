import { IdGenerator } from '../../../shared/domain/id-generator';
import { Tag } from '../entities/tag';
import { TagRepository } from '../repositories/tag.repository';

interface CreateTagProps {
  name: string;
  color: string | null;
  workspaceId: string;
}

export class CreateTag {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: TagRepository,
  ) {}

  async execute(props: CreateTagProps): Promise<Tag> {
    const tag = new Tag({
      id: this.idGenerator.create(),
      name: props.name,
      color: props.color,
      workspaceId: props.workspaceId,
    });

    await this.repository.create(tag);
    return tag;
  }
}
