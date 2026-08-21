import { EntityNotFoundError } from '../../../shared/domain/errors';
import { OrganizationRepository } from '../repositories/organization.repository';

interface DeleteOrganizationProps {
  id: string;
}

export class DeleteOrganization {
  constructor(private readonly repository: OrganizationRepository) {}

  async execute(props: DeleteOrganizationProps): Promise<void> {
    const org = await this.repository.findById(props.id);
    if (!org) throw new EntityNotFoundError('Organization not found');

    await this.repository.softDelete(props.id);
  }
}
