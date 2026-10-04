import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TagRepository } from '../repositories/tag.repository';

interface DeleteTagProps {
  id: string;
  /** The workspace of the caller; an item of any other workspace is not found. */
  workspaceId: string;
}

export class DeleteTag {
  constructor(private readonly repository: TagRepository) {}

  async execute(props: DeleteTagProps): Promise<void> {
    const tag = await this.repository.findById(props.id);
    if (!tag || tag.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Tag not found');
    }

    await this.repository.delete(props.id);
  }
}
