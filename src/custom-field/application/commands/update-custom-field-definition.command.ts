import { Command } from '../../../shared/domain/command';
import { UpdateCustomFieldDefinition } from '../../domain/services/custom-field-definition-update';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  name?: string;
  options?: string[] | null;
  required?: boolean;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface UpdateCustomFieldDefinitionResponse {
  id: string;
  name: string;
  type: string;
  options: string[] | null;
  position: number;
  required: boolean;
}

export class UpdateCustomFieldDefinitionCommand implements Command<Props, UpdateCustomFieldDefinitionResponse> {
  constructor(
    private readonly updateDefinition: UpdateCustomFieldDefinition,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<UpdateCustomFieldDefinitionResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.CUSTOM_FIELD_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const definition = await this.updateDefinition.execute({
      id: props.id,
      name: props.name,
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
