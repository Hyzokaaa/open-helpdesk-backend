import { EntityNotFoundError } from '../../../shared/domain/errors';
import { CustomFieldDefinition } from '../entities/custom-field-definition';
import { CustomFieldDefinitionRepository } from '../repositories/custom-field-definition.repository';

interface UpdateCustomFieldDefinitionProps {
  id: string;
  name?: string;
  options?: string[] | null;
  required?: boolean;
}

export class UpdateCustomFieldDefinition {
  constructor(private readonly repository: CustomFieldDefinitionRepository) {}

  async execute(props: UpdateCustomFieldDefinitionProps): Promise<CustomFieldDefinition> {
    const definition = await this.repository.findById(props.id);
    if (!definition) {
      throw new EntityNotFoundError('Custom field definition not found');
    }

    if (props.name !== undefined) definition.name = props.name;
    if (props.options !== undefined) definition.options = props.options;
    if (props.required !== undefined) definition.required = props.required;

    await this.repository.update(definition);
    return definition;
  }
}
