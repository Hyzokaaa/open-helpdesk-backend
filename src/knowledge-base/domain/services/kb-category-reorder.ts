import { KbCategoryRepository } from '../repositories/kb-category.repository';

export class ReorderKbCategories {
  constructor(private readonly repository: KbCategoryRepository) {}

  async execute(ids: string[]): Promise<void> {
    await this.repository.updatePositions(
      ids.map((id, index) => ({ id, position: index })),
    );
  }
}
