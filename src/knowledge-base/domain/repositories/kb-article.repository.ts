import { KbArticle } from '../entities/kb-article';

export interface KbArticleRepository {
  create(article: KbArticle): Promise<void>;
  findById(id: string): Promise<KbArticle | null>;
  findByWorkspaceId(workspaceId: string): Promise<KbArticle[]>;
  findPublishedByWorkspaceId(workspaceId: string): Promise<KbArticle[]>;
  findByCategoryId(categoryId: string): Promise<KbArticle[]>;
  findPublishedByCategoryId(categoryId: string): Promise<KbArticle[]>;
  findBySlugAndWorkspaceId(slug: string, workspaceId: string): Promise<KbArticle | null>;
  searchPublished(workspaceId: string, query: string): Promise<KbArticle[]>;
  update(article: KbArticle): Promise<void>;
  delete(id: string): Promise<void>;
  updatePositions(items: Array<{ id: string; position: number }>): Promise<void>;
  getMaxPosition(categoryId: string): Promise<number>;
}
