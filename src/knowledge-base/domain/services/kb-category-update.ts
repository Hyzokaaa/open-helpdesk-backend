import { EntityNotFoundError } from '../../../shared/domain/errors';
import { slugify } from '../../../shared/domain/slugify';
import { KbCategory } from '../entities/kb-category';
import { KbCategoryRepository } from '../repositories/kb-category.repository';

interface Props {
  id: string;
  /** The workspace of the caller; an item of any other workspace is not found. */
  workspaceId: string;
  name?: string;
  icon?: string | null;
}

export class UpdateKbCategory {
  constructor(private readonly repository: KbCategoryRepository) {}

  async execute(props: Props): Promise<KbCategory> {
    const category = await this.repository.findById(props.id);
    if (!category || category.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Category not found');

    if (props.name !== undefined) {
      category.name = props.name;
      category.slug = slugify(props.name);
    }
    if (props.icon !== undefined) category.icon = props.icon;

    await this.repository.update(category);
    return category;
  }
}
