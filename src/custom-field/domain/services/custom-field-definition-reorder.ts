import { EntityNotFoundError } from '../../../shared/domain/errors';
import { CustomFieldDefinitionRepository } from '../repositories/custom-field-definition.repository';

interface ReorderItem {
  id: string;
  position: number;
}

export class ReorderCustomFieldDefinitions {
  constructor(private readonly repository: CustomFieldDefinitionRepository) {}

  async execute(items: ReorderItem[], workspaceId: string): Promise<void> {
    // A reorder is one operation: if any id is not of this workspace, nothing is changed.
    const own = new Set((await this.repository.findByWorkspaceId(workspaceId)).map((item) => item.getId()));
    if (items.map((item) => item.id).some((id) => !own.has(id))) throw new EntityNotFoundError('Custom field definition not found');
    await this.repository.updatePositions(items);
  }
}
