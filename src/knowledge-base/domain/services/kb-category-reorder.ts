import { EntityNotFoundError } from '../../../shared/domain/errors';
import { KbCategoryRepository } from '../repositories/kb-category.repository';

export class ReorderKbCategories {
  constructor(private readonly repository: KbCategoryRepository) {}

  async execute(ids: string[], workspaceId: string): Promise<void> {
    // A reorder is one operation: if any id is not of this workspace, nothing is changed.
    const own = new Set((await this.repository.findByWorkspaceId(workspaceId)).map((item) => item.getId()));
    if (ids.some((id) => !own.has(id))) throw new EntityNotFoundError('Category not found');
    await this.repository.updatePositions(
      ids.map((id, index) => ({ id, position: index })),
    );
  }
}
