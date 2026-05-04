import { Command } from '../../../shared/domain/command';
import { CreateCustomFieldDefinition } from '../../domain/services/custom-field-definition-create';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { CustomFieldType } from '../../domain/enums/custom-field-type.enum';

interface Props {
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  required: boolean;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CreateCustomFieldDefinitionResponse {
  id: string;
  name: string;
  type: string;
  options: string[] | null;
  position: number;
  required: boolean;
}

export class CreateCustomFieldDefinitionCommand implements Command<Props, CreateCustomFieldDefinitionResponse> {
  constructor(
    private readonly createDefinition: CreateCustomFieldDefinition,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<CreateCustomFieldDefinitionResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.CUSTOM_FIELD_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const definition = await this.createDefinition.execute({
      workspaceId: props.workspaceId,
      name: props.name,
      type: props.type,
      options: props.options,
      required: props.required,
    });

    return {
      id: definition.getId(),
      name: definition.name,
      type: definition.type,
      options: definition.options,
      position: definition.position,
      required: definition.required,
    };
  }
}
