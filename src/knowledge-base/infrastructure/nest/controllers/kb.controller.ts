import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../../workspace/domain/permissions';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmKbCategoryRepository } from '../../typeorm/repositories/typeorm-kb-category.repository';
import { TypeOrmKbArticleRepository } from '../../typeorm/repositories/typeorm-kb-article.repository';
import { CreateKbCategory } from '../../../domain/services/kb-category-create';
import { UpdateKbCategory } from '../../../domain/services/kb-category-update';
import { DeleteKbCategory } from '../../../domain/services/kb-category-delete';
import { ReorderKbCategories } from '../../../domain/services/kb-category-reorder';
import { CreateKbArticle } from '../../../domain/services/kb-article-create';
import { UpdateKbArticle } from '../../../domain/services/kb-article-update';
import { DeleteKbArticle } from '../../../domain/services/kb-article-delete';
import { ReorderKbArticles } from '../../../domain/services/kb-article-reorder';

@Controller('workspaces/:slug/kb')
export class KbController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly categoryRepository: TypeOrmKbCategoryRepository,
    @Inject() private readonly articleRepository: TypeOrmKbArticleRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  // --- Categories ---

  @Get('categories')
  async listCategories(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.KB_ARTICLE_VIEW);
    const categories = await this.categoryRepository.findByWorkspaceId(workspaceId);
    return categories.map((c) => ({ id: c.getId(), name: c.name, slug: c.slug, icon: c.icon, position: c.position }));
  }

  @Post('categories')
  async createCategory(
    @Param('slug') slug: string,
    @Body() body: { name: string; icon?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.KB_CATEGORY_MANAGE);
    const service = new CreateKbCategory(this.idGenerator, this.categoryRepository);
    const category = await service.execute({ name: body.name, icon: body.icon, workspaceId });
    return { id: category.getId(), name: category.name, slug: category.slug };
  }

  @Put('categories/:id')
  async updateCategory(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: { name?: string; icon?: string | null },
    @CurrentUser() user: AuthUser,
  ) {
    await this.resolveWorkspaceId(slug);
    await this.ensurePermission(await this.resolveWorkspaceId(slug), user, PERMISSIONS.KB_CATEGORY_MANAGE);
    const service = new UpdateKbCategory(this.categoryRepository);
    const category = await service.execute({ id, name: body.name, icon: body.icon });
    return { id: category.getId(), name: category.name, slug: category.slug };
  }

  @Delete('categories/:id')
  async deleteCategory(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.resolveWorkspaceId(slug);
    await this.ensurePermission(await this.resolveWorkspaceId(slug), user, PERMISSIONS.KB_CATEGORY_MANAGE);
    const service = new DeleteKbCategory(this.categoryRepository);
    await service.execute(id);
  }

  @Put('categories/reorder')
  async reorderCategories(
    @Param('slug') slug: string,
    @Body() body: { ids: string[] },
    @CurrentUser() user: AuthUser,
  ) {
    await this.resolveWorkspaceId(slug);
    await this.ensurePermission(await this.resolveWorkspaceId(slug), user, PERMISSIONS.KB_CATEGORY_MANAGE);
    const service = new ReorderKbCategories(this.categoryRepository);
    await service.execute(body.ids);
  }

  // --- Articles ---

  @Get('articles')
  async listArticles(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.KB_ARTICLE_VIEW);
    const articles = await this.articleRepository.findByWorkspaceId(workspaceId);
    return articles.map((a) => ({
      id: a.getId(), title: a.title, slug: a.slug, status: a.status,
      position: a.position, categoryId: a.categoryId,
    }));
  }

  @Get('articles/suggest')
  async suggestArticles(
    @Param('slug') slug: string,
    @Query('q') query: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.KB_ARTICLE_VIEW);
    if (!query || query.length < 2) return [];
    const articles = await this.articleRepository.searchPublished(workspaceId, query);
    return articles.slice(0, 10).map((a) => ({
      id: a.getId(), title: a.title, slug: a.slug, categoryId: a.categoryId,
    }));
  }

  @Get('articles/:id')
  async getArticle(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.KB_ARTICLE_VIEW);
    const article = await this.articleRepository.findById(id);
    if (!article || article.workspaceId !== workspaceId) throw new EntityNotFoundError('Article not found');
    return {
      id: article.getId(), title: article.title, slug: article.slug,
      content: article.content, status: article.status,
      position: article.position, categoryId: article.categoryId,
    };
  }

  @Post('articles')
  async createArticle(
    @Param('slug') slug: string,
    @Body() body: { title: string; content: string; categoryId: string; status?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.KB_ARTICLE_CREATE);
    const service = new CreateKbArticle(this.idGenerator, this.articleRepository);
    const article = await service.execute({
      title: body.title, content: body.content, categoryId: body.categoryId,
      workspaceId, createdById: user.userId, status: body.status as any,
    });
    return { id: article.getId(), title: article.title, slug: article.slug, status: article.status };
  }

  @Put('articles/:id')
  async updateArticle(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string; status?: string; categoryId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    await this.resolveWorkspaceId(slug);
    await this.ensurePermission(await this.resolveWorkspaceId(slug), user, PERMISSIONS.KB_ARTICLE_EDIT);
    const service = new UpdateKbArticle(this.articleRepository);
    const article = await service.execute({ id, title: body.title, content: body.content, status: body.status as any, categoryId: body.categoryId });
    return { id: article.getId(), title: article.title, slug: article.slug, status: article.status };
  }

  @Delete('articles/:id')
  async deleteArticle(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.resolveWorkspaceId(slug);
    await this.ensurePermission(await this.resolveWorkspaceId(slug), user, PERMISSIONS.KB_ARTICLE_DELETE);
    const service = new DeleteKbArticle(this.articleRepository);
    await service.execute(id);
  }

  @Put('articles/reorder')
  async reorderArticles(
    @Param('slug') slug: string,
    @Body() body: { ids: string[] },
    @CurrentUser() user: AuthUser,
  ) {
    await this.resolveWorkspaceId(slug);
    await this.ensurePermission(await this.resolveWorkspaceId(slug), user, PERMISSIONS.KB_ARTICLE_EDIT);
    const service = new ReorderKbArticles(this.articleRepository);
    await service.execute(body.ids);
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }

  private async ensurePermission(workspaceId: string, user: AuthUser, permission: string) {
    const service = new EnsureWorkspacePermission(this.memberRepository);
    await service.execute({ workspaceId, userId: user.userId, permission: permission as any, isSystemAdmin: user.isSystemAdmin });
  }
}
