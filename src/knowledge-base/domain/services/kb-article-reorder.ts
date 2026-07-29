import { KbArticleRepository } from '../repositories/kb-article.repository';

export class ReorderKbArticles {
  constructor(private readonly repository: KbArticleRepository) {}

  async execute(ids: string[]): Promise<void> {
    await this.repository.updatePositions(
      ids.map((id, index) => ({ id, position: index })),
    );
  }
}
