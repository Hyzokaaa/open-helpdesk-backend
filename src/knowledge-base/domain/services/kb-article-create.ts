import { IdGenerator } from '../../../shared/domain/id-generator';
import { slugify } from '../../../shared/domain/slugify';
import { KbArticle } from '../entities/kb-article';
import { KbArticleStatus } from '../enums/kb-article-status.enum';
import { KbArticleRepository } from '../repositories/kb-article.repository';

interface Props {
  title: string;
  content: string;
  categoryId: string;
  workspaceId: string;
  createdById: string;
  status?: KbArticleStatus;
}

export class CreateKbArticle {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: KbArticleRepository,
  ) {}

  async execute(props: Props): Promise<KbArticle> {
    let slug = slugify(props.title);
    const existing = await this.repository.findBySlugAndWorkspaceId(slug, props.workspaceId);
    if (existing) slug = `${slug}-${this.idGenerator.create().substring(0, 4).toLowerCase()}`;

    const position = (await this.repository.getMaxPosition(props.categoryId)) + 1;

    const article = new KbArticle({
      id: this.idGenerator.create(),
      title: props.title,
      slug,
      content: props.content,
      status: props.status ?? KbArticleStatus.DRAFT,
      position,
      categoryId: props.categoryId,
      workspaceId: props.workspaceId,
      createdById: props.createdById,
    });

    await this.repository.create(article);
    return article;
  }
}
