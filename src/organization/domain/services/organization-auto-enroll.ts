import { OrganizationRepository } from '../repositories/organization.repository';
import { ResolveOrganizationByEmail } from './organization-resolve-by-email';

interface AutoEnrollResult {
  organizationId: string | null;
}

export class AutoEnrollOrganization {
  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async execute(email: string, workspaceId: string): Promise<AutoEnrollResult> {
    const resolver = new ResolveOrganizationByEmail(this.organizationRepository);
    const org = await resolver.execute(email, workspaceId);
    return { organizationId: org ? org.getId() : null };
  }
}
