import { EntityNotFoundError } from '../../../shared/domain/errors';
import { OrganizationRepository } from '../repositories/organization.repository';

interface DeleteOrganizationProps {
  id: string;
  /** The workspace of the caller; an item of any other workspace is not found. */
  workspaceId: string;
}

export class DeleteOrganization {
  constructor(private readonly repository: OrganizationRepository) {}

  async execute(props: DeleteOrganizationProps): Promise<void> {
    const org = await this.repository.findById(props.id);
    if (!org || org.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Organization not found');

    await this.repository.softDelete(props.id);
  }
}
