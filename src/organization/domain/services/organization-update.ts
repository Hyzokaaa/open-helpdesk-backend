import { EntityNotFoundError } from '../../../shared/domain/errors';
import { OrganizationRepository } from '../repositories/organization.repository';
import { Organization } from '../entities/organization';

interface UpdateOrganizationProps {
  id: string;
  name?: string;
  description?: string | null;
  domains?: string[];
}

export class UpdateOrganization {
  constructor(private readonly repository: OrganizationRepository) {}

  async execute(props: UpdateOrganizationProps): Promise<Organization> {
    const org = await this.repository.findById(props.id);
    if (!org) throw new EntityNotFoundError('Organization not found');

    if (props.name !== undefined) org.name = props.name;
    if (props.description !== undefined) org.description = props.description;
    if (props.domains !== undefined) {
      org.domains = props.domains.map((d) => d.toLowerCase().trim()).filter(Boolean);
    }

    await this.repository.update(org);
    return org;
  }
}
