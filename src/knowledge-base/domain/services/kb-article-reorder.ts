import { EntityNotFoundError } from '../../../shared/domain/errors';
import { KbArticleRepository } from '../repositories/kb-article.repository';

export class ReorderKbArticles {
  constructor(private readonly repository: KbArticleRepository) {}

  async execute(ids: string[], workspaceId: string): Promise<void> {
    // A reorder is one operation: if any id is not of this workspace, nothing is changed.
    const own = new Set((await this.repository.findByWorkspaceId(workspaceId)).map((item) => item.getId()));
    if (ids.some((id) => !own.has(id))) throw new EntityNotFoundError('Article not found');
    await this.repository.updatePositions(
      ids.map((id, index) => ({ id, position: index })),
    );
  }
}
