import { DomainValidationError } from '../../../shared/domain/errors';
import { CustomFieldType } from '../enums/custom-field-type.enum';
import { CustomFieldDefinitionRepository } from '../repositories/custom-field-definition.repository';

interface ValidateProps {
  workspaceId: string;
  customFields?: Record<string, unknown>;
  isCreate: boolean;
}

export class ValidateCustomFieldValues {
  constructor(private readonly repository: CustomFieldDefinitionRepository) {}

  async execute(props: ValidateProps): Promise<Record<string, unknown>> {
    const definitions = await this.repository.findByWorkspaceId(props.workspaceId);
    const values = props.customFields ?? {};
    const validated: Record<string, unknown> = {};

    for (const def of definitions) {
      const value = values[def.getId()];

      if (def.required && props.isCreate && (value === undefined || value === null || value === '')) {
        throw new DomainValidationError(`Custom field "${def.name}" is required`);
      }

      if (value === undefined || value === null) continue;

      switch (def.type) {
        case CustomFieldType.TEXT:
          if (typeof value !== 'string') throw new DomainValidationError(`Custom field "${def.name}" must be text`);
          break;
        case CustomFieldType.NUMBER:
          if (typeof value !== 'number') throw new DomainValidationError(`Custom field "${def.name}" must be a number`);
          break;
        case CustomFieldType.CHECKBOX:
          if (typeof value !== 'boolean') throw new DomainValidationError(`Custom field "${def.name}" must be true or false`);
          break;
        case CustomFieldType.SELECT:
          if (typeof value !== 'string' || !def.options?.includes(value)) {
            throw new DomainValidationError(`Custom field "${def.name}" must be one of: ${def.options?.join(', ')}`);
          }
          break;
        case CustomFieldType.MULTI_SELECT:
          if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' && def.options?.includes(v))) {
            throw new DomainValidationError(`Custom field "${def.name}" must be a list of valid options`);
          }
          break;
        case CustomFieldType.DATE:
          if (typeof value !== 'string' || isNaN(Date.parse(value))) {
            throw new DomainValidationError(`Custom field "${def.name}" must be a valid date`);
          }
          break;
      }

      validated[def.getId()] = value;
    }

    return validated;
  }
}
