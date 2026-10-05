import { EntityNotFoundError } from '../../../shared/domain/errors';
import { KbArticleRepository } from '../repositories/kb-article.repository';

export class DeleteKbArticle {
  constructor(private readonly repository: KbArticleRepository) {}

  async execute(id: string, workspaceId: string): Promise<void> {
    const article = await this.repository.findById(id);
    if (!article || article.workspaceId !== workspaceId) throw new EntityNotFoundError('Article not found');
    await this.repository.delete(id);
  }
}
