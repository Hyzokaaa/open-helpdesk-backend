import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmKbCategoryRepository } from '../../typeorm/repositories/typeorm-kb-category.repository';
import { TypeOrmKbArticleRepository } from '../../typeorm/repositories/typeorm-kb-article.repository';

@Public()
@Controller('portal/:slug/kb')
export class KbPortalController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly categoryRepository: TypeOrmKbCategoryRepository,
    @Inject() private readonly articleRepository: TypeOrmKbArticleRepository,
  ) {}

  @Get('categories')
  async listCategories(@Param('slug') slug: string) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const categories = await this.categoryRepository.findByWorkspaceId(workspaceId);
    const articles = await this.articleRepository.findPublishedByWorkspaceId(workspaceId);

    return categories.map((c) => ({
      id: c.getId(),
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      articleCount: articles.filter((a) => a.categoryId === c.getId()).length,
    })).filter((c) => c.articleCount > 0);
  }

  @Get('categories/:categorySlug/articles')
  async listArticles(
    @Param('slug') slug: string,
    @Param('categorySlug') categorySlug: string,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const category = await this.categoryRepository.findBySlugAndWorkspaceId(categorySlug, workspaceId);
    if (!category) throw new EntityNotFoundError('Category not found');

    const articles = await this.articleRepository.findPublishedByCategoryId(category.getId());
    return articles.map((a) => ({
      id: a.getId(),
      title: a.title,
      slug: a.slug,
      content: a.content.substring(0, 200),
    }));
  }

  @Get('articles/:articleSlug')
  async getArticle(
    @Param('slug') slug: string,
    @Param('articleSlug') articleSlug: string,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const article = await this.articleRepository.findBySlugAndWorkspaceId(articleSlug, workspaceId);
    if (!article || article.status !== 'published') throw new EntityNotFoundError('Article not found');

    const category = await this.categoryRepository.findById(article.categoryId);
    return {
      id: article.getId(),
      title: article.title,
      slug: article.slug,
      content: article.content,
      category: category ? { name: category.name, slug: category.slug } : null,
    };
  }

  @Get('search')
  async search(
    @Param('slug') slug: string,
    @Query('q') query: string,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    if (!query || query.length < 2) return [];

    const articles = await this.articleRepository.searchPublished(workspaceId, query);
    return articles.map((a) => ({
      id: a.getId(),
      title: a.title,
      slug: a.slug,
      content: a.content.substring(0, 200),
      categoryId: a.categoryId,
    }));
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }
}
