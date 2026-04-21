import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TagRepository } from '../repositories/tag.repository';

interface DeleteTagProps {
  id: string;
}

export class DeleteTag {
  constructor(private readonly repository: TagRepository) {}

  async execute(props: DeleteTagProps): Promise<void> {
    const tag = await this.repository.findById(props.id);
    if (!tag) {
      throw new EntityNotFoundError('Tag not found');
    }

    await this.repository.delete(props.id);
  }
}
