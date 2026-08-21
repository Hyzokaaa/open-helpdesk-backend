import { Command } from '../../../shared/domain/command';
import { CreateOrganization } from '../../domain/services/organization-create';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  name: string;
  description: string | null;
  domains: string[];
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CreateOrganizationResponse {
  id: string;
  name: string;
  description: string | null;
  domains: string[];
}

export class CreateOrganizationCommand implements Command<Props, CreateOrganizationResponse> {
  constructor(
    private readonly createOrganization: CreateOrganization,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<CreateOrganizationResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.ORGANIZATION_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const org = await this.createOrganization.execute({
      name: props.name,
      description: props.description,
      domains: props.domains,
      workspaceId: props.workspaceId,
    });

    return { id: org.getId(), name: org.name, description: org.description, domains: org.domains };
  }
}
