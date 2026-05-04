import { IdGenerator } from '../../../shared/domain/id-generator';
import { CustomFieldDefinition } from '../entities/custom-field-definition';
import { CustomFieldType } from '../enums/custom-field-type.enum';
import { CustomFieldDefinitionRepository } from '../repositories/custom-field-definition.repository';

interface CreateCustomFieldDefinitionProps {
  workspaceId: string;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  required: boolean;
}

export class CreateCustomFieldDefinition {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: CustomFieldDefinitionRepository,
  ) {}

  async execute(props: CreateCustomFieldDefinitionProps): Promise<CustomFieldDefinition> {
    const existing = await this.repository.findByWorkspaceId(props.workspaceId);
    const position = existing.length;

    const definition = new CustomFieldDefinition({
      id: this.idGenerator.create(),
      workspaceId: props.workspaceId,
      name: props.name,
      type: props.type,
      options: props.options,
      position,
      required: props.required,
    });

    await this.repository.create(definition);
    return definition;
  }
}
