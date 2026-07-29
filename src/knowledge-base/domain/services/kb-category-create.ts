import { IdGenerator } from '../../../shared/domain/id-generator';
import { slugify } from '../../../shared/domain/slugify';
import { KbCategory } from '../entities/kb-category';
import { KbCategoryRepository } from '../repositories/kb-category.repository';

interface Props {
  name: string;
  icon?: string | null;
  workspaceId: string;
}

export class CreateKbCategory {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: KbCategoryRepository,
  ) {}

  async execute(props: Props): Promise<KbCategory> {
    let slug = slugify(props.name);
    const existing = await this.repository.findBySlugAndWorkspaceId(slug, props.workspaceId);
    if (existing) slug = `${slug}-${this.idGenerator.create().substring(0, 4).toLowerCase()}`;

    const position = (await this.repository.getMaxPosition(props.workspaceId)) + 1;

    const category = new KbCategory({
      id: this.idGenerator.create(),
      name: props.name,
      slug,
      icon: props.icon ?? null,
      position,
      workspaceId: props.workspaceId,
    });

    await this.repository.create(category);
    return category;
  }
}
