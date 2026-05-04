import { Query } from '../../../shared/domain/query';
import { CustomFieldDefinitionRepository } from '../../domain/repositories/custom-field-definition.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CustomFieldDefinitionListItem {
  id: string;
  name: string;
  type: string;
  options: string[] | null;
  position: number;
  required: boolean;
}

export class ListCustomFieldDefinitionsQuery implements Query<Props, CustomFieldDefinitionListItem[]> {
  constructor(
    private readonly repository: CustomFieldDefinitionRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<CustomFieldDefinitionListItem[]> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.CUSTOM_FIELD_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const definitions = await this.repository.findByWorkspaceId(props.workspaceId);
    return definitions
      .sort((a, b) => a.position - b.position)
      .map((d) => ({
        id: d.getId(),
        name: d.name,
        type: d.type,
        options: d.options,
        position: d.position,
        required: d.required,
      }));
  }
}
