import { EntityNotFoundError } from '../../../shared/domain/errors';
import { slugify } from '../../../shared/domain/slugify';
import { KbArticle } from '../entities/kb-article';
import { KbArticleStatus } from '../enums/kb-article-status.enum';
import { KbArticleRepository } from '../repositories/kb-article.repository';
import { sanitizeHtml } from '../../../shared/domain/sanitize-html';

const KB_SANITIZE_OPTIONS = {
  extraTags: ['h2', 'h3', 'img'],
  extraAttrs: { img: ['src', 'alt'] },
  extraSelfClosing: ['img'],
};

interface Props {
  id: string;
  title?: string;
  content?: string;
  status?: KbArticleStatus;
  categoryId?: string;
}

export class UpdateKbArticle {
  constructor(private readonly repository: KbArticleRepository) {}

  async execute(props: Props): Promise<KbArticle> {
    const article = await this.repository.findById(props.id);
    if (!article) throw new EntityNotFoundError('Article not found');

    if (props.title !== undefined) {
      article.title = props.title;
      article.slug = slugify(props.title);
    }
    if (props.content !== undefined) article.content = sanitizeHtml(props.content, KB_SANITIZE_OPTIONS);
    if (props.status !== undefined) article.status = props.status;
    if (props.categoryId !== undefined) article.categoryId = props.categoryId;

    await this.repository.update(article);
    return article;
  }
}
