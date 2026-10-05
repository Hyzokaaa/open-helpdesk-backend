import { EntityNotFoundError } from '../../../shared/domain/errors';
import { KbCategoryRepository } from '../repositories/kb-category.repository';

export class DeleteKbCategory {
  constructor(private readonly repository: KbCategoryRepository) {}

  /** Deleting a category deletes its articles, so it must be one of the caller's workspace. */
  async execute(id: string, workspaceId: string): Promise<void> {
    const category = await this.repository.findById(id);
    if (!category || category.workspaceId !== workspaceId) throw new EntityNotFoundError('Category not found');
    await this.repository.delete(id);
  }
}
