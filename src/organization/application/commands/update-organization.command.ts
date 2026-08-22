import { Command } from '../../../shared/domain/command';
import { UpdateOrganization } from '../../domain/services/organization-update';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  name?: string;
  description?: string | null;
  notes?: string | null;
  domains?: string[];
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface UpdateOrganizationResponse {
  id: string;
  name: string;
  description: string | null;
  domains: string[];
}

export class UpdateOrganizationCommand implements Command<Props, UpdateOrganizationResponse> {
  constructor(
    private readonly updateOrganization: UpdateOrganization,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<UpdateOrganizationResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.ORGANIZATION_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const org = await this.updateOrganization.execute({
      id: props.id,
      name: props.name,
      description: props.description,
      notes: props.notes,
      domains: props.domains,
    });

    return { id: org.getId(), name: org.name, description: org.description, domains: org.domains };
  }
}
