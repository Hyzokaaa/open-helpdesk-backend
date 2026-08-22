import { IdGenerator } from '../../../shared/domain/id-generator';
import { Organization } from '../entities/organization';
import { OrganizationRepository } from '../repositories/organization.repository';

interface CreateOrganizationProps {
  name: string;
  description: string | null;
  domains: string[];
  workspaceId: string;
}

export class CreateOrganization {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: OrganizationRepository,
  ) {}

  async execute(props: CreateOrganizationProps): Promise<Organization> {
    const org = new Organization({
      id: this.idGenerator.create(),
      name: props.name,
      description: props.description,
      notes: null,
      logo: null,
      domains: props.domains.map((d) => d.toLowerCase().trim()).filter(Boolean),
      workspaceId: props.workspaceId,
    });

    await this.repository.create(org);
    return org;
  }
}
