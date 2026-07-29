import { KbArticleRepository } from '../repositories/kb-article.repository';

export class DeleteKbArticle {
  constructor(private readonly repository: KbArticleRepository) {}

  async execute(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
