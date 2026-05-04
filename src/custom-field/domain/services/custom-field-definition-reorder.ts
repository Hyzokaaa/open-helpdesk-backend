import { CustomFieldDefinitionRepository } from '../repositories/custom-field-definition.repository';

interface ReorderItem {
  id: string;
  position: number;
}

export class ReorderCustomFieldDefinitions {
  constructor(private readonly repository: CustomFieldDefinitionRepository) {}

  async execute(items: ReorderItem[]): Promise<void> {
    await this.repository.updatePositions(items);
  }
}
