import { EntityNotFoundError } from '../../../shared/domain/errors';
import { CustomFieldDefinitionRepository } from '../repositories/custom-field-definition.repository';

interface DeleteCustomFieldDefinitionProps {
  id: string;
}

export class DeleteCustomFieldDefinition {
  constructor(private readonly repository: CustomFieldDefinitionRepository) {}

  async execute(props: DeleteCustomFieldDefinitionProps): Promise<void> {
    const definition = await this.repository.findById(props.id);
    if (!definition) {
      throw new EntityNotFoundError('Custom field definition not found');
    }

    await this.repository.delete(props.id);
  }
}
