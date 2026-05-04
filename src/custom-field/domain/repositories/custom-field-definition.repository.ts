import { CustomFieldDefinition } from '../entities/custom-field-definition';

export interface CustomFieldDefinitionRepository {
  create(definition: CustomFieldDefinition): Promise<void>;
  findById(id: string): Promise<CustomFieldDefinition | null>;
  findByWorkspaceId(workspaceId: string): Promise<CustomFieldDefinition[]>;
  update(definition: CustomFieldDefinition): Promise<void>;
  delete(id: string): Promise<void>;
  updatePositions(items: { id: string; position: number }[]): Promise<void>;
}
