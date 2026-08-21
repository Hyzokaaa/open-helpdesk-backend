import { Query } from '../../../shared/domain/query';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface OrganizationListItem {
  id: string;
  name: string;
  description: string | null;
  domains: string[];
  logo: string | null;
}

export class ListOrganizationsQuery implements Query<Props, OrganizationListItem[]> {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<OrganizationListItem[]> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.ORGANIZATION_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const orgs = await this.organizationRepository.findByWorkspaceId(props.workspaceId);
    return orgs.map((org) => ({
      id: org.getId(),
      name: org.name,
      description: org.description,
      domains: org.domains,
      logo: org.logo,
    }));
  }
}
