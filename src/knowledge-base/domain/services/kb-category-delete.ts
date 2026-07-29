import { KbCategoryRepository } from '../repositories/kb-category.repository';

export class DeleteKbCategory {
  constructor(private readonly repository: KbCategoryRepository) {}

  async execute(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
